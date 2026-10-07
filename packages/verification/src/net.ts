/**
 * Address classification for Step 7 (shared by the `sec.dev-urls` text check and the rendered-QA link
 * checker's egress policy in packages/rendered-qa/src/egress.ts). Pure, no I/O, no DNS.
 *
 * "Non-public" = anything a QA job runner must never be made to reach on a built page's say-so: loopback,
 * private (RFC 1918), carrier-grade NAT, link-local (incl. the 169.254.169.254 cloud metadata address),
 * "this network", multicast, reserved and documentation ranges, and the IPv6 equivalents (::1, ::, ULA fc00::/7,
 * link-local fe80::/10, multicast, IPv4-mapped/compatible forms of any of the IPv4 ranges, NAT64 and 6to4
 * wrappers of them).
 */
import { isIP } from "node:net";

const V4_BLOCKS: [string, number, string][] = [
  ["0.0.0.0", 8, "this-network"],
  ["10.0.0.0", 8, "private"],
  ["100.64.0.0", 10, "carrier-grade NAT"],
  ["127.0.0.0", 8, "loopback"],
  ["169.254.0.0", 16, "link-local / cloud metadata"],
  ["172.16.0.0", 12, "private"],
  ["192.0.0.0", 24, "IETF protocol assignments"],
  ["192.0.2.0", 24, "documentation"],
  ["192.88.99.0", 24, "6to4 relay"],
  ["192.168.0.0", 16, "private"],
  ["198.18.0.0", 15, "benchmarking"],
  ["198.51.100.0", 24, "documentation"],
  ["203.0.113.0", 24, "documentation"],
  ["224.0.0.0", 4, "multicast"],
  ["240.0.0.0", 4, "reserved"],
];

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((n, octet) => n * 256 + Number(octet), 0);
}

function v4Block(ip: string): string | null {
  const n = v4ToInt(ip);
  for (const [base, bits, label] of V4_BLOCKS) {
    const size = 2 ** (32 - bits);
    const start = v4ToInt(base);
    if (n >= start && n < start + size) return label;
  }
  return null;
}

/** Expands an IPv6 address to 8 16-bit groups (handles "::" and a dotted IPv4 tail). */
function v6Groups(ip: string): number[] | null {
  let addr = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]!;
  const dotted = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    if (isIP(dotted[1]!) !== 4) return null;
    const n = v4ToInt(dotted[1]!);
    addr = addr.slice(0, -dotted[1]!.length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

const intToV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

/** Why an IP literal is not a public address, or null when it is public. Unparseable input counts as non-public. */
export function nonPublicReason(ip: string): string | null {
  const bare = ip.replace(/^\[|\]$/g, "");
  const kind = isIP(bare.split("%")[0]!);
  if (kind === 4) return v4Block(bare);
  if (kind !== 6) return "not an IP address";
  const g = v6Groups(bare);
  if (!g) return "unparseable IPv6 address";
  if (g.every((x) => x === 0)) return "unspecified (::)";
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return "loopback (::1)";
  // IPv4-mapped ::ffff:a.b.c.d, IPv4-compatible ::a.b.c.d, NAT64 64:ff9b::a.b.c.d: judge the embedded IPv4.
  const embedded =
    (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) || (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0));
  if (embedded) {
    const inner = v4Block(intToV4(g[6]!, g[7]!));
    return inner ? `IPv4-in-IPv6 wrapper of a ${inner} address` : null;
  }
  if (g[0] === 0x2002) {
    const inner = v4Block(intToV4(g[1]!, g[2]!));
    if (inner) return `6to4 wrapper of a ${inner} address`;
  }
  if ((g[0]! & 0xfe00) === 0xfc00) return "unique local (fc00::/7)";
  if ((g[0]! & 0xffc0) === 0xfe80) return "link-local (fe80::/10)";
  if ((g[0]! & 0xff00) === 0xff00) return "multicast (ff00::/8)";
  if (g[0] === 0x2001 && g[1] === 0x0db8) return "documentation (2001:db8::/32)";
  return null;
}

/** Hostnames that always mean "this machine or its private network", resolved or not. */
const LOCAL_NAME = /(^|\.)(localhost|local|internal|intranet|lan|home\.arpa|localdomain)$/i;
const METADATA_NAME = /^(metadata|metadata\.google\.internal|instance-data|instance-data\.ec2\.internal)$/i;

/**
 * Why a URL host (as written on a page, before any DNS) is local or private, or null if it looks public.
 * Catches IP literals in every form WHATWG URL parsing normalises (decimal 2130706433, octal 0177.0.0.1 and hex
 * 0x7f.1 all become 127.0.0.1 inside `new URL`), single-label names and local suffixes. A public-looking
 * name may still RESOLVE to a private address: the egress policy re-checks after DNS.
 */
export function nonPublicHostReason(host: string): string | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "") return "empty host";
  if (isIP(h.replace(/^\[|\]$/g, "")) !== 0) return nonPublicReason(h);
  if (METADATA_NAME.test(h)) return "cloud metadata host name";
  if (LOCAL_NAME.test(h)) return "local host name";
  if (!h.includes(".")) return "single-label host name (resolves on the local network)";
  return null;
}
