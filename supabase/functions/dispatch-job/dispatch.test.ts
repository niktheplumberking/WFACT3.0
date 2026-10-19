// dispatch-job unit tests (Step 21 H). They exercise the deployed index.ts unchanged: Deno.serve is stubbed to
// capture the handler, and fetch is stubbed to stand in for Supabase (auth, PostgREST) and the GitHub API. No
// network, no real token. SYNTHETIC: every id, key and row below is made up for the test.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";

const SUPABASE = "https://stub.supabase.test";
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const COCKPIT = "https://wfact-3-cockpit.vercel.app";

type Job = { id: string; status: string; created_by: string; kind: string };
const state = {
  user: OWNER as string | null,
  role: "owner" as string | null,
  job: { id: JOB, status: "queued", created_by: OWNER, kind: "intake" } as Job | null,
  githubStatus: 204,
  writes: [] as { table: string; method: string; body: Record<string, unknown> }[],
  githubCalls: [] as { url: string; body: Record<string, unknown> }[],
};

function reset(over: Partial<typeof state> = {}) {
  Object.assign(state, {
    user: OWNER,
    role: "owner",
    job: { id: JOB, status: "queued", created_by: OWNER, kind: "intake" },
    githubStatus: 204,
    writes: [],
    githubCalls: [],
  }, over);
  Deno.env.set("GITHUB_DISPATCH_TOKEN", "test-token-not-real");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// One row for a maybeSingle() read: PostgREST returns an object when asked for one, else an array.
function rowResponse(req: Request, row: Record<string, unknown> | null): Response {
  const wantsObject = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
  if (wantsObject) return row ? json(row) : json({ code: "PGRST116", message: "0 rows" }, 406);
  return json(row ? [row] : []);
}

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const req = input instanceof Request ? input : new Request(input, init);
  const url = new URL(req.url);
  if (url.origin === "https://api.github.com") {
    state.githubCalls.push({ url: req.url, body: await req.json() });
    return new Response(state.githubStatus === 204 ? null : "nope", { status: state.githubStatus });
  }
  assertEquals(url.origin, SUPABASE, `unexpected outbound call to ${url.origin}`);
  if (url.pathname === "/auth/v1/user") {
    return state.user ? json({ id: state.user, aud: "authenticated", role: "authenticated" }) : json({ msg: "bad jwt" }, 401);
  }
  const table = url.pathname.replace("/rest/v1/", "");
  if (req.method === "GET" && table === "profiles") return rowResponse(req, state.role ? { role: state.role } : null);
  if (req.method === "GET" && table === "jobs") return rowResponse(req, state.job);
  const body = await req.json();
  state.writes.push({ table, method: req.method, body });
  return new Response(null, { status: 204 });
};

Deno.env.set("SUPABASE_URL", SUPABASE);
Deno.env.set("SUPABASE_ANON_KEY", "anon-not-real");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-not-real");

let handler: ((req: Request) => Promise<Response>) | undefined;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: (req: Request) => Promise<Response>) => {
  handler = h;
  return { finished: Promise.resolve(), shutdown: () => Promise.resolve() };
};
await import("./index.ts");
assert(handler, "index.ts registers a handler with Deno.serve");

const call = (body: unknown, opts: { method?: string; origin?: string } = {}) =>
  handler!(new Request("https://fn.test/dispatch-job", {
    method: opts.method ?? "POST",
    headers: { Authorization: "Bearer jwt-not-real", "Content-Type": "application/json", origin: opts.origin ?? COCKPIT },
    body: (opts.method ?? "POST") === "POST" ? JSON.stringify(body) : undefined,
  }));

Deno.test("CORS: a Cockpit origin gets the allow headers on preflight; any other origin gets none", async () => {
  reset();
  for (const origin of [COCKPIT, "https://wfact-cockpit-git-huraira-work-niktheplumberkings-projects.vercel.app"]) {
    const ok = await call(null, { method: "OPTIONS", origin });
    assertEquals(ok.status, 204);
    assertEquals(ok.headers.get("access-control-allow-origin"), origin);
  }
  const refused = await call(null, { method: "OPTIONS", origin: "https://evil.example" });
  assertEquals(refused.status, 204);
  assertEquals(refused.headers.get("access-control-allow-origin"), null);
});

Deno.test("only POST is accepted", async () => {
  reset();
  assertEquals((await call(null, { method: "GET" })).status, 405);
});

Deno.test("refuses a caller who is not signed in, or is not an owner/admin, before reading any job", async () => {
  reset({ user: null });
  assertEquals((await call({ jobId: JOB })).status, 401);
  reset({ role: "pm" });
  assertEquals((await call({ jobId: JOB })).status, 403);
  assertEquals(state.githubCalls.length, 0);
  assertEquals(state.writes.length, 0);
});

Deno.test("refuses a bad job id, a missing job, someone else's job and a job that is not queued", async () => {
  reset();
  assertEquals((await call({ jobId: "../../etc" })).status, 400);
  reset({ job: null });
  assertEquals((await call({ jobId: JOB })).status, 404);
  reset({ job: { id: JOB, status: "queued", created_by: OTHER, kind: "intake" } });
  assertEquals((await call({ jobId: JOB })).status, 403);
  reset({ job: { id: JOB, status: "running", created_by: OWNER, kind: "intake" } });
  const res = await call({ jobId: JOB });
  assertEquals(res.status, 409);
  assertMatch((await res.json()).error, /already running/);
  assertEquals(state.githubCalls.length, 0, "nothing is dispatched for a refused request");
});

Deno.test("without the GitHub token the job is failed loudly, never left looking queued", async () => {
  reset();
  Deno.env.delete("GITHUB_DISPATCH_TOKEN");
  const res = await call({ jobId: JOB });
  assertEquals(res.status, 503);
  assertEquals(state.githubCalls.length, 0);
  const w = state.writes.find((x) => x.table === "jobs");
  assertEquals(w?.body.status, "failed");
  assertMatch(String(w?.body.error), /GITHUB_DISPATCH_TOKEN/);
});

Deno.test("a GitHub refusal fails the job with the HTTP status", async () => {
  reset({ githubStatus: 422 });
  assertEquals((await call({ jobId: JOB })).status, 502);
  const w = state.writes.find((x) => x.table === "jobs");
  assertEquals(w?.body.status, "failed");
  assertMatch(String(w?.body.error), /HTTP 422/);
});

Deno.test("a valid request dispatches only the job id, marks it dispatched and writes an audit row", async () => {
  reset();
  const res = await call({ jobId: JOB, extra: "ignored" });
  assertEquals(res.status, 202);
  assertEquals(state.githubCalls.length, 1);
  assertMatch(state.githubCalls[0]!.url, /\/actions\/workflows\/cockpit-job\.yml\/dispatches$/);
  assertEquals(state.githubCalls[0]!.body.inputs, { job_id: JOB }, "only the job id leaves this function");
  assertEquals(state.writes.find((x) => x.table === "jobs")?.body.status, "dispatched");
  const audit = state.writes.find((x) => x.table === "audit_log");
  assertEquals(audit?.body.action, "job.dispatched");
  assertEquals(audit?.body.actor, OWNER);
});
