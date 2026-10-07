/**
 * Egress policy for rendered QA (Factory Completion Plan Step 7; the QA-runner SSRF gap Step 6 found,
 * docs/AGENT-PERMISSIONS.md §6). A built page is untrusted input: whatever URLs it contains must never make
 * the job runner reach loopback services, the private network or the cloud metadata endpoint.
 *
 * Two layers:
 *   1. The browser (Playwright and Lighthouse's Chrome) is launched with the site's own static server as its
 *      only proxy and the implicit loopback bypass removed (`<-loopback>`), so EVERY request the page makes
 *      reaches that server, which serves the built files for its own origin and refuses everything else
 *      (server.ts). Same-site links are checked against the built files, not fetched.
 *   2. External links are checked only when asked for (`--external-links`), and only here: http(s) on the
 *      default ports, no credentials in the URL, the host resolved and EVERY address checked against the
 *      non-public ranges (packages/verification/src/net.ts), the connection pinned to the checked address
 *      (no second DNS answer can swap in a private one), every redirect hop re-checked, at most 3 hops, a
 *      bounded timeout per request, no body read, no cookies.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { nonPublicHostReason, nonPublicReason } from "@wfact/verification/net";

export interface ResolvedAddress {
  address: string;
  family: number;
}

export interface EgressOptions {
  /** DNS resolver (tests inject one). Must return every address the name resolves to. */
  lookup?: (hostname: string) => Promise<ResolvedAddress[]>;
  /** Why an IP is not allowed, or null when it is public. Tests may widen it; production uses nonPublicReason. */
  addressPolicy?: (ip: string) => string | null;
  /** Per-request timeout, ms. */
  timeoutMs?: number;
  maxRedirects?: number;
  /** Extra ports allowed besides 80/443 (tests only: a local server cannot bind port 80). */
  allowPorts?: string[];
}

export type LinkCheck =
  | { outcome: "ok"; status: number; finalUrl: string }
  | { outcome: "http-error"; status: number; finalUrl: string }
  | { outcome: "refused"; reason: string; url: string }
  | { outcome: "unreachable"; reason: string; url: string };

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_REDIRECTS = 3;

const defaultLookup = async (hostname: string): Promise<ResolvedAddress[]> => dnsLookup(hostname, { all: true, verbatim: true });

/** Why a URL may not be fetched before any DNS (scheme, port, credentials, a non-public literal or local name). */
export function urlRefusal(url: URL, allowPorts: string[] = []): string | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") return `scheme ${url.protocol} is not checked`;
  if (url.username || url.password) return "credentials in the URL";
  if (url.port && !allowPorts.includes(url.port)) return `non-standard port ${url.port}`;
  return nonPublicHostReason(url.hostname);
}

/** Resolves the host and returns the one address to connect to, or why none is allowed. */
async function pinAddress(url: URL, opts: Required<Pick<EgressOptions, "lookup" | "addressPolicy">>): Promise<ResolvedAddress | { refused: string }> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    const why = opts.addressPolicy(host);
    return why ? { refused: `${host} is ${why}` } : { address: host, family: isIP(host) };
  }
  const addrs = await opts.lookup(host);
  if (addrs.length === 0) return { refused: `${host} does not resolve` };
  // Every answer must be public: a name with one private answer is refused outright (rebinding-style answers).
  for (const a of addrs) {
    const why = opts.addressPolicy(a.address);
    if (why) return { refused: `${host} resolves to ${a.address} (${why})` };
  }
  return addrs[0]!;
}

function requestOnce(url: URL, pinned: ResolvedAddress, method: "HEAD" | "GET", timeoutMs: number): Promise<{ status: number; location: string | null }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method,
        // Connect to the address we checked, never to a fresh DNS answer.
        lookup: (_host: string, options: unknown, cb: (err: Error | null, address: string | ResolvedAddress[], family?: number) => void) => {
          if ((options as { all?: boolean })?.all) cb(null, [pinned]);
          else cb(null, pinned.address, pinned.family);
        },
        headers: { "user-agent": "WFACT-rendered-qa-linkcheck/1", accept: "*/*" },
        timeout: timeoutMs,
        agent: false,
      },
      (res) => {
        resolve({ status: res.statusCode ?? 0, location: typeof res.headers.location === "string" ? res.headers.location : null });
        res.destroy(); // never read the body
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timed out after ${timeoutMs} ms`)));
    req.on("error", reject);
    req.end();
  });
}

/**
 * Checks one external link under the egress policy. Never throws; a refusal is reported as such (the URL is
 * not contacted at all), a network failure as unreachable.
 */
export async function checkExternalLink(raw: string, options: EgressOptions = {}): Promise<LinkCheck> {
  const opts = {
    lookup: options.lookup ?? defaultLookup,
    addressPolicy: options.addressPolicy ?? nonPublicReason,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRedirects: options.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    allowPorts: options.allowPorts ?? [],
  };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { outcome: "refused", reason: "not a valid URL", url: raw };
  }
  for (let hop = 0; hop <= opts.maxRedirects; hop += 1) {
    const refusal = urlRefusal(url, opts.allowPorts);
    if (refusal) return { outcome: "refused", reason: hop ? `redirect to ${url.href}: ${refusal}` : refusal, url: url.href };
    let pinned: ResolvedAddress | { refused: string };
    try {
      pinned = await pinAddress(url, opts);
    } catch (err) {
      return { outcome: "unreachable", reason: `DNS: ${err instanceof Error ? err.message : String(err)}`, url: url.href };
    }
    if ("refused" in pinned) return { outcome: "refused", reason: hop ? `redirect to ${url.href}: ${pinned.refused}` : pinned.refused, url: url.href };
    let res: { status: number; location: string | null };
    try {
      res = await requestOnce(url, pinned, "HEAD", opts.timeoutMs);
      if (res.status === 405 || res.status === 403 || res.status === 501) res = await requestOnce(url, pinned, "GET", opts.timeoutMs);
    } catch (err) {
      return { outcome: "unreachable", reason: err instanceof Error ? err.message : String(err), url: url.href };
    }
    if (res.status >= 300 && res.status < 400 && res.location) {
      try {
        url = new URL(res.location, url);
      } catch {
        return { outcome: "unreachable", reason: `bad redirect location ${res.location.slice(0, 80)}`, url: url.href };
      }
      continue;
    }
    return res.status >= 400 ? { outcome: "http-error", status: res.status, finalUrl: url.href } : { outcome: "ok", status: res.status, finalUrl: url.href };
  }
  return { outcome: "unreachable", reason: `more than ${opts.maxRedirects} redirects`, url: url.href };
}

/**
 * Chrome flags that send every request the page makes to `proxyOrigin` (the site's own static server), with
 * the implicit loopback bypass removed, so a page cannot reach any other port or host, loopback included.
 */
export function confinedBrowserArgs(proxyOrigin: string): string[] {
  return [`--proxy-server=${proxyOrigin}`, "--proxy-bypass-list=<-loopback>"];
}
