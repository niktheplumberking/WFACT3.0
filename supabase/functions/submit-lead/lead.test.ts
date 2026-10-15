// submit-lead unit tests (Step 25 / MVP M4). node:test + node:assert, so the same file runs under Node
// (`node --experimental-strip-types --test supabase/functions/submit-lead/`) and Deno (`deno test`, CI job submit-lead).
// The store is in memory; every value is synthetic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, MIN_FILL_MS, RATE_LIMIT, SITE_CEILING, type DropReason, type LeadRow, type LeadSite, type LeadStore } from "./lead.ts";

const KEY = "0b7d3c1e-2a4f-4e6b-9c8d-1f2e3a4b5c6d";
const ORIGIN = "https://lanternworks.example.test";
const NOW = 1_760_500_000_000;
const SITE: LeadSite = { id: "site-1", client_id: "client-1", allowed_origins: [ORIGIN, "http://localhost:4173"], is_test: true };

function memoryStore(sites: Record<string, LeadSite> = { [KEY]: SITE }) {
  const leads: (LeadRow & { at: number })[] = [];
  const drops: Record<string, number> = {};
  const store: LeadStore = {
    siteByKey: async (k) => sites[k] ?? null,
    originAllowed: async (o) => Object.values(sites).some((s) => s.allowed_origins.includes(o)),
    recentCount: async (siteId, ipHash, since) => leads.filter((l) => l.lead_site_id === siteId && (ipHash === null || l.ip_hash === ipHash) && l.at >= Date.parse(since)).length,
    insertLead: async (row) => void leads.push({ ...row, at: NOW }),
    recordDrop: async (siteId, reason: DropReason) => void (drops[`${siteId}:${reason}`] = (drops[`${siteId}:${reason}`] ?? 0) + 1),
  };
  return { store, leads, drops };
}

const enquiry = (extra: Record<string, string> = {}) => ({
  site_key: KEY, variant: "enquiry", page: "/contact/", fill_ms: "20000", website: "",
  name: "Test Visitor", email: "visitor@example.test", message: "Synthetic enquiry for a test.", ...extra,
});

function post(body: Record<string, string>, opts: { origin?: string | null; form?: boolean; ip?: string; raw?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {
    "content-type": opts.form ? "application/x-www-form-urlencoded" : "application/json",
    "x-forwarded-for": `${opts.ip ?? "203.0.113.7"}, 10.0.0.1`,
    "user-agent": "test-agent",
    ...opts.headers,
  };
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  const text = opts.raw ?? (opts.form ? new URLSearchParams(body).toString() : JSON.stringify(body));
  return new Request("https://example.supabase.co/functions/v1/submit-lead", { method: "POST", headers, body: text });
}

function run(req: Request, s = memoryStore(), salt: string | null = "test-salt") {
  const logs: string[] = [];
  return { s, logs, res: handle(req, { store: s.store, salt, now: () => NOW, log: (l) => logs.push(l) }) };
}

test("a JSON enquiry from an allowed origin is stored once, with CORS, a salted IP hash and no raw IP", async () => {
  const { s, res } = run(post(enquiry()));
  const r = await res;
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(s.leads.length, 1);
  const lead = s.leads[0]!;
  assert.deepEqual(lead.fields, { name: "Test Visitor", email: "visitor@example.test", message: "Synthetic enquiry for a test." });
  assert.equal(lead.form_variant, "enquiry");
  assert.equal(lead.page_path, "/contact/");
  assert.equal(lead.client_id, "client-1");
  assert.equal(lead.is_test, true);
  assert.match(lead.ip_hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(lead).includes("203.0.113.7"));
});

test("a form post (no JavaScript) is stored and answered 303 to its page with ?sent=1", async () => {
  const { s, res } = run(post(enquiry({ fill_ms: "" }), { form: true }));
  const r = await res;
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), `${ORIGIN}/contact/?sent=1#lead-sent`);
  assert.equal(s.leads.length, 1);
});

test("a form post with a missing field goes back to its page with ?error=<code>, nothing stored", async () => {
  const { s, res } = run(post(enquiry({ email: "" }), { form: true }));
  const r = await res;
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), `${ORIGIN}/contact/?error=missing_field#lead-error`);
  assert.equal(s.leads.length, 0);
});

test("the Track A request form and the signup form validate their own fields", async () => {
  const req = { site_key: KEY, variant: "request", page: "/", fill_ms: "9000", name: "Test Visitor", phone: "+1 555 0100 222", need: "Synthetic", address: "", time: "Morning" };
  const a = run(post(req));
  assert.equal((await a.res).status, 200);
  assert.deepEqual(a.s.leads[0]!.fields, { name: "Test Visitor", phone: "+1 555 0100 222", need: "Synthetic", time: "Morning" });
  assert.equal((await (await run(post({ ...req, phone: "call me" })).res).json()).error, "invalid_phone");
  const signup = { site_key: KEY, variant: "signup", page: "/", fill_ms: "9000", email: "visitor@example.test" };
  const b = run(post(signup));
  assert.equal((await b.res).status, 200);
  assert.deepEqual(b.s.leads[0]!.fields, { email: "visitor@example.test" });
  assert.equal((await (await run(post({ ...signup, message: "a brief" })).res).json()).error, "unknown_field");
  assert.equal((await (await run(post({ ...signup, email: "not-an-email" })).res).json()).error, "invalid_email");
});

test("unknown fields, over-long answers, a bad variant and a too-large body are refused", async () => {
  const one = async (body: Record<string, string>) => (await (await run(post(body)).res).json()).error;
  assert.equal(await one(enquiry({ password: "x" })), "unknown_field");
  assert.equal(await one(enquiry({ name: "x".repeat(121) })), "too_long");
  assert.equal(await one(enquiry({ variant: "order" })), "bad_variant");
  assert.equal(await one(enquiry({ variant: "__proto__" })), "bad_variant");
  const big = await run(post(enquiry({ message: "x".repeat(11_000) }))).res;
  assert.equal(big.status, 413);
  const nested = await run(post({}, { raw: JSON.stringify({ ...enquiry(), name: { a: 1 } }) })).res;
  assert.equal(nested.status, 400);
  const repeated = await run(post({}, { form: true, raw: `${new URLSearchParams(enquiry())}&name=again` })).res;
  assert.equal(repeated.status, 400);
});

test("a wrong origin, a missing origin and an unknown site key are refused, logged by name, nothing stored", async () => {
  const wrong = run(post(enquiry(), { origin: "https://evil.example.test" }));
  const r = await wrong.res;
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  assert.equal((await r.json()).error, "origin_not_allowed");
  assert.match(wrong.logs[0]!, /submit-lead: refused origin "https:\/\/evil\.example\.test" for site site-1/);
  assert.equal(wrong.s.leads.length, 0);

  const none = run(post(enquiry(), { origin: null }));
  assert.equal((await none.res).status, 403);

  const unknown = run(post(enquiry({ site_key: "11111111-2222-4333-8444-555555555555" })));
  const u = await unknown.res;
  assert.equal(u.status, 404);
  assert.equal(u.headers.get("location"), null);
  assert.match(unknown.logs[0]!, /unknown or inactive site_key 11111111/);

  const bad = await run(post(enquiry({ site_key: "not-a-key" }))).res;
  assert.equal(bad.status, 400);
});

test("a form post from a wrong origin is never redirected (the target is not trusted)", async () => {
  const r = await run(post(enquiry(), { form: true, origin: "https://evil.example.test" })).res;
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("location"), null);
});

test("a filled honeypot is accepted, dropped and counted; the content is not stored or logged", async () => {
  const { s, logs, res } = run(post(enquiry({ website: "http://spam.example.test" })));
  const r = await res;
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(s.leads.length, 0);
  assert.equal(s.drops["site-1:honeypot"], 1);
  assert.ok(!logs.join(" ").includes("spam.example.test"));
});

test("a form sent faster than a person can (or with a garbled fill time) is dropped and counted", async () => {
  const fast = run(post(enquiry({ fill_ms: String(MIN_FILL_MS - 1) })));
  assert.equal((await fast.res).status, 200);
  assert.equal(fast.s.leads.length, 0);
  assert.equal(fast.s.drops["site-1:too_fast"], 1);
  for (const bad of ["yesterday", "-5000", "3000.5"]) {
    const r = run(post(enquiry({ fill_ms: bad })));
    await r.res;
    assert.equal(r.s.leads.length, 0, bad);
  }
  // The fill time is the visitor's own clock (load to submit), so a skewed clock cannot drop a real message.
  const slow = run(post(enquiry({ fill_ms: String(MIN_FILL_MS) })));
  await slow.res;
  assert.equal(slow.s.leads.length, 1);
});

test(`the ${RATE_LIMIT.max + 1}th post from one connection inside ${RATE_LIMIT.windowMs / 60_000} minutes is refused 429; another connection is not`, async () => {
  const s = memoryStore();
  for (let i = 0; i < RATE_LIMIT.max; i += 1) assert.equal((await run(post(enquiry()), s).res).status, 200);
  const sixth = await run(post(enquiry()), s).res;
  assert.equal(sixth.status, 429);
  assert.equal((await sixth.json()).error, "rate_limited");
  assert.equal(s.leads.length, RATE_LIMIT.max);
  assert.equal(s.drops["site-1:rate_limited"], 1);
  assert.equal((await run(post(enquiry(), { ip: "198.51.100.9" }), s).res).status, 200);
  const formSixth = await run(post(enquiry(), { form: true }), s).res;
  assert.equal(formSixth.headers.get("location"), `${ORIGIN}/contact/?error=rate_limited#lead-error`);
});

test("without LEAD_IP_SALT nothing is accepted, and it says so", async () => {
  const { s, logs, res } = run(post(enquiry()), memoryStore(), null);
  const r = await res;
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "not_configured");
  assert.equal(s.leads.length, 0);
  assert.match(logs[0]!, /LEAD_IP_SALT is not set/);
});

test("a store failure is a plain server error, logged without the visitor's details", async () => {
  const s = memoryStore();
  s.store.insertLead = async () => {
    throw new Error("leads insert: 23514");
  };
  const { logs, res } = run(post(enquiry()), s);
  const r = await res;
  assert.equal(r.status, 500);
  assert.equal((await r.json()).error, "server_error");
  assert.match(logs[0]!, /store failed for site site-1 \(leads insert: 23514\)/);
  assert.ok(!logs.join(" ").includes("visitor@example.test"));
});

test("the CORS preflight answers only an origin some active site allows, and names a refused one", async () => {
  const pre = (origin: string) => new Request("https://example.supabase.co/functions/v1/submit-lead", { method: "OPTIONS", headers: { origin } });
  const ok = await run(pre(ORIGIN)).res;
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), ORIGIN);
  const refused = run(pre("https://evil.example.test"));
  const r = await refused.res;
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  assert.match(refused.logs[0]!, /submit-lead: CORS refused origin "https:\/\/evil\.example\.test"/);
});

test("other methods and content types are refused", async () => {
  assert.equal((await run(new Request("https://x.test/", { method: "GET", headers: { origin: ORIGIN } })).res).status, 405);
  const plain = new Request("https://x.test/", { method: "POST", headers: { origin: ORIGIN, "content-type": "text/plain" }, body: "hi" });
  assert.equal((await run(plain).res).status, 415);
});

test("a page path that is not a plain site path is refused and the redirect goes to the site root", async () => {
  const r = await run(post(enquiry({ page: "//evil.example.test/x" }), { form: true })).res;
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), `${ORIGIN}/?error=bad_request#lead-error`);
});

test(`a site takes at most ${SITE_CEILING.max} leads an hour across all connections (rotating IP headers do not flood it)`, async () => {
  const s = memoryStore();
  for (let i = 0; i < SITE_CEILING.max; i += 1) assert.equal((await run(post(enquiry(), { ip: `198.51.100.${i % 250}`, headers: { "cf-connecting-ip": `192.0.2.${i}` } }), s).res).status, 200);
  const over = await run(post(enquiry(), { headers: { "cf-connecting-ip": "192.0.2.250" } }), s).res;
  assert.equal(over.status, 429);
  assert.equal(s.leads.length, SITE_CEILING.max);
});

test("the edge's cf-connecting-ip wins over a client-set x-forwarded-for", async () => {
  const s = memoryStore();
  for (let i = 0; i < RATE_LIMIT.max; i += 1) await run(post(enquiry(), { ip: `203.0.113.${i}`, headers: { "cf-connecting-ip": "192.0.2.1" } }), s).res;
  const sixth = await run(post(enquiry(), { ip: "203.0.113.99", headers: { "cf-connecting-ip": "192.0.2.1" } }), s).res;
  assert.equal(sixth.status, 429, "a fresh x-forwarded-for does not reset the limit");
});

test("a chunked body over the cap (no content-length) is refused without buffering it all", async () => {
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      pulled += 1;
      if (pulled > 50) return c.close();
      c.enqueue(new Uint8Array(1024).fill(32));
    },
  });
  const req = new Request("https://example.supabase.co/functions/v1/submit-lead", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
  const r = await run(req).res;
  assert.equal(r.status, 413);
  assert.ok(pulled < 20, `stopped reading early (${pulled} chunks)`);
});

test("an origin that is not a plain web origin is never looked up and never reflected", async () => {
  let looked = 0;
  const s = memoryStore();
  s.store.originAllowed = async () => (looked += 1, true);
  for (const bad of [" ", "https://a.example.test,https://b.example.test", "null", "javascript:alert(1)"]) {
    const pre = await run(new Request("https://x.test/", { method: "OPTIONS", headers: { origin: bad } }), s).res;
    assert.equal(pre.headers.get("access-control-allow-origin"), null, bad);
  }
  assert.equal(looked, 0);
});
