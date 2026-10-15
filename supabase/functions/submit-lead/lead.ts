// submit-lead: the logic, with the database behind a small interface so it is tested without Supabase (lead.test.ts runs
// under Node locally and Deno in CI). index.ts wires it to the service-role client. Step 25 / MVP M4.
//
// A client site's contact form posts here: as JSON from the site's script, or as a plain form post when the visitor has
// no JavaScript. The site key in the body picks the site; the Origin must be one of that site's allowed origins. Spam
// (a filled honeypot, a form sent faster than a person can) is accepted and dropped so a bot learns nothing; only a
// count is kept. Everything the visitor typed is data: it is length-capped, stored and never logged.

export const MAX_BODY_BYTES = 10_240;
export const MIN_FILL_MS = 3_000;
export const RATE_LIMIT = { max: 5, windowMs: 10 * 60_000 } as const;
/** A ceiling per site across all connections, so rotating IP headers cannot flood one client's leads. */
export const SITE_CEILING = { max: 100, windowMs: 60 * 60_000 } as const;

export type Variant = "request" | "enquiry" | "signup";
export type DropReason = "honeypot" | "too_fast" | "rate_limited";

export interface LeadSite {
  id: string;
  client_id: string;
  allowed_origins: string[];
  is_test: boolean;
}

export interface LeadRow {
  lead_site_id: string;
  client_id: string;
  form_variant: Variant;
  page_path: string;
  fields: Record<string, string>;
  ip_hash: string;
  user_agent: string | null;
  is_test: boolean;
}

export interface LeadStore {
  /** The ACTIVE site with this key, or null. */
  siteByKey(siteKey: string): Promise<LeadSite | null>;
  /** True when any active site lists this origin (answers the CORS preflight, which carries no body). */
  originAllowed(origin: string): Promise<boolean>;
  /** Leads stored for this site since the given time: from one ip_hash, or from anyone when ipHash is null. */
  recentCount(siteId: string, ipHash: string | null, sinceIso: string): Promise<number>;
  insertLead(row: LeadRow): Promise<void>;
  recordDrop(siteId: string, reason: DropReason): Promise<void>;
}

export interface Deps {
  store: LeadStore;
  /** LEAD_IP_SALT; null when the secret is not set, and then nothing is accepted. */
  salt: string | null;
  now?: () => number;
  log?: (line: string) => void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A plain site path; never "//…" (a redirect to it would read as another host).
const PAGE = /^\/(?!\/)[A-Za-z0-9/_.-]{0,299}$/;
const EMAIL = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;
const PHONE = /^[0-9+()\-.\s]{6,40}$/;
// The same shape lead_sites.allowed_origins accepts (migration 0025); anything else is never looked up.
const ORIGIN = /^(https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+|http:\/\/(localhost|127\.0\.0\.1))(:[0-9]{1,5})?$/;

/**
 * The control fields every form sends. `website` is the honeypot (hidden from people, left empty by them). `fill_ms` is how
 * long the form was open, measured by the site's script on the visitor's own clock (page load to submit), so clock skew
 * cannot drop a real message; a form without JavaScript sends it empty.
 */
const CONTROL = new Set(["site_key", "variant", "page", "fill_ms", "website"]);

/** Per variant: required and optional fields. Track A's request form; Track B's enquiry and signup forms. */
export const VARIANTS: Record<Variant, { required: string[]; optional: string[] }> = {
  request: { required: ["name", "phone", "need"], optional: ["address", "time"] },
  enquiry: { required: ["name", "email", "message"], optional: ["organisation", "timing"] },
  signup: { required: ["email"], optional: ["name"] },
};

export const CAPS: Record<string, number> = {
  name: 120, phone: 40, email: 254, address: 200, need: 4000, message: 4000, organisation: 160, time: 40, timing: 40,
};

/** What the visitor is told for each error code (the sites show their own copy; this is for the JSON reply). */
export const ERROR_MESSAGES: Record<string, string> = {
  bad_request: "The form could not be read. Please try again.",
  bad_variant: "The form could not be read. Please try again.",
  unknown_field: "The form sent a field it should not have. Please reload the page and try again.",
  missing_field: "Please fill in the required fields.",
  invalid_email: "Please enter an email address we can reply to.",
  invalid_phone: "Please enter a phone number we can call.",
  too_long: "One of the answers is too long. Please shorten it and try again.",
  too_large: "The form is too large to send.",
  unsupported_type: "The form could not be read. Please try again.",
  unknown_site: "This form is not connected.",
  origin_not_allowed: "This form cannot be sent from this address.",
  rate_limited: "Too many messages from this connection. Please wait a few minutes, or call or email instead.",
  not_configured: "The form is not available right now. Please call or email instead.",
  server_error: "Something went wrong on our side. Please call or email instead.",
};

type Mode = "json" | "form";

function corsHeaders(origin: string | null): Record<string, string> {
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        Vary: "Origin",
      }
    : {};
}

function json(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } });
}

/** A reply for a request whose site and origin are known: JSON for the script, a 303 back to the page for a form post. */
function reply(mode: Mode, origin: string, page: string, status: number, error: string | null): Response {
  if (mode === "form") {
    const target = `${origin}${page}${error ? `?error=${error}#lead-error` : "?sent=1#lead-sent"}`;
    return new Response(null, { status: 303, headers: { Location: target, ...corsHeaders(origin) } });
  }
  return json(status, error ? { ok: false, error, message: ERROR_MESSAGES[error] } : { ok: true }, origin);
}

/** A reply before the site and origin are trusted: never a redirect (the target is not known to be safe), no CORS. */
function refuse(status: number, error: string): Response {
  return json(status, { ok: false, error, message: ERROR_MESSAGES[error] }, null);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The body as name → value; null when it is not a flat set of strings (or a name repeats). */
export function parseBody(text: string, mode: Mode): Map<string, string> | null {
  const out = new Map<string, string>();
  if (mode === "json") {
    let v: unknown;
    try {
      v = JSON.parse(text);
    } catch {
      return null;
    }
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val !== "string") return null;
      out.set(k, val);
    }
    return out;
  }
  const params = new URLSearchParams(text);
  for (const k of params.keys()) {
    if (out.has(k)) return null;
    out.set(k, params.get(k) ?? "");
  }
  return out;
}

/** The fields to store for this variant, or an error code. Empty optional fields are left out. */
export function validateFields(variant: Variant, body: Map<string, string>): { fields: Record<string, string> } | { error: string } {
  const spec = VARIANTS[variant];
  const known = new Set([...spec.required, ...spec.optional]);
  for (const k of body.keys()) if (!CONTROL.has(k) && !known.has(k)) return { error: "unknown_field" };
  const fields: Record<string, string> = {};
  for (const k of [...spec.required, ...spec.optional]) {
    const v = (body.get(k) ?? "").trim();
    if (!v) {
      if (spec.required.includes(k)) return { error: "missing_field" };
      continue;
    }
    if (v.length > (CAPS[k] ?? 200)) return { error: "too_long" };
    if (k === "email" && !EMAIL.test(v)) return { error: "invalid_email" };
    if (k === "phone" && (!PHONE.test(v) || (v.match(/[0-9]/g) ?? []).length < 6)) return { error: "invalid_phone" };
    fields[k] = v;
  }
  return { fields };
}

/** The visitor's address as the platform's edge saw it; the first x-forwarded-for entry (client-settable) is the last resort. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim() || (fwd ? fwd.split(",")[0]!.trim() : "")) || "unknown";
}

/** The body as text, read with a running byte cap (a chunked body has no content-length to check first); null when over. */
async function readCapped(req: Request): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

const reason = (e: unknown) => (e instanceof Error ? e.message.slice(0, 120) : "unknown");

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? ((l: string) => console.warn(l));
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    // The preflight has no body, so it answers for any active site that lists the origin; the POST checks the exact site.
    let ok = false;
    if (origin && ORIGIN.test(origin)) {
      try {
        ok = await deps.store.originAllowed(origin);
      } catch (e) {
        log(`submit-lead: origin lookup failed (${reason(e)})`);
      }
    }
    // Edge logs don't record the Origin header, so name a refused one here (as dispatch-job does).
    if (origin && !ok) log(`submit-lead: CORS refused origin ${JSON.stringify(origin.slice(0, 200))}`);
    return new Response(null, { status: 204, headers: corsHeaders(ok ? origin : null) });
  }
  if (req.method !== "POST") return refuse(405, "bad_request");

  const type = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const mode: Mode | null = type === "application/json" ? "json" : type === "application/x-www-form-urlencoded" ? "form" : null;
  if (!mode) return refuse(415, "unsupported_type");
  if (Number(req.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) return refuse(413, "too_large");
  const text = await readCapped(req);
  if (text === null) return refuse(413, "too_large");
  const body = parseBody(text, mode);
  if (!body) return refuse(400, "bad_request");

  const siteKey = body.get("site_key") ?? "";
  if (!UUID.test(siteKey)) return refuse(400, "unknown_site");
  let site: LeadSite | null;
  try {
    site = await deps.store.siteByKey(siteKey.toLowerCase());
  } catch (e) {
    log(`submit-lead: site lookup failed (${reason(e)})`);
    return refuse(500, "server_error");
  }
  if (!site) {
    // The key is public (it is in the page source), so naming its first characters leaks nothing.
    log(`submit-lead: unknown or inactive site_key ${siteKey.slice(0, 8)}...`);
    return refuse(404, "unknown_site");
  }
  if (!origin || !ORIGIN.test(origin) || !site.allowed_origins.includes(origin)) {
    log(`submit-lead: refused origin ${JSON.stringify((origin ?? "(none)").slice(0, 200))} for site ${site.id}`);
    return refuse(403, "origin_not_allowed");
  }

  // From here the origin is trusted: replies carry CORS, and a form post goes back to its page.
  const rawPage = body.get("page") ?? "/";
  if (!PAGE.test(rawPage)) return reply(mode, origin, "/", 400, "bad_request");
  const page = rawPage;

  // Spam: accepted and dropped, counted, never stored.
  if ((body.get("website") ?? "") !== "") {
    await deps.store.recordDrop(site.id, "honeypot").catch(() => log("submit-lead: drop count failed (honeypot)"));
    return reply(mode, origin, page, 200, null);
  }
  const fillRaw = body.get("fill_ms");
  // A visitor without JavaScript sends no fill time (the script measures it); the honeypot and the rate limits still apply.
  if (fillRaw !== undefined && fillRaw !== "") {
    const fill = Number(fillRaw);
    if (!Number.isInteger(fill) || fill < MIN_FILL_MS) {
      await deps.store.recordDrop(site.id, "too_fast").catch(() => log("submit-lead: drop count failed (too_fast)"));
      return reply(mode, origin, page, 200, null);
    }
  }

  const variant = body.get("variant") ?? "";
  if (!Object.hasOwn(VARIANTS, variant)) return reply(mode, origin, page, 400, "bad_variant");
  const checked = validateFields(variant as Variant, body);
  if ("error" in checked) return reply(mode, origin, page, 400, checked.error);

  if (!deps.salt) {
    log("submit-lead: LEAD_IP_SALT is not set; nothing is accepted until it is");
    return reply(mode, origin, page, 503, "not_configured");
  }
  const ipHash = await sha256Hex(`${deps.salt}|${clientIp(req)}`);

  try {
    const since = new Date(now() - RATE_LIMIT.windowMs).toISOString();
    const siteSince = new Date(now() - SITE_CEILING.windowMs).toISOString();
    if ((await deps.store.recentCount(site.id, ipHash, since)) >= RATE_LIMIT.max || (await deps.store.recentCount(site.id, null, siteSince)) >= SITE_CEILING.max) {
      await deps.store.recordDrop(site.id, "rate_limited").catch(() => log("submit-lead: drop count failed (rate_limited)"));
      return reply(mode, origin, page, 429, "rate_limited");
    }
    await deps.store.insertLead({
      lead_site_id: site.id,
      client_id: site.client_id,
      form_variant: variant as Variant,
      page_path: page,
      fields: checked.fields,
      ip_hash: ipHash,
      user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
      is_test: site.is_test,
    });
  } catch (e) {
    log(`submit-lead: store failed for site ${site.id} (${reason(e)})`);
    return reply(mode, origin, page, 500, "server_error");
  }
  return reply(mode, origin, page, 200, null);
}
