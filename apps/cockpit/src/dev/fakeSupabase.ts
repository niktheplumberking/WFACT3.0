/**
 * DEV ONLY: the test double for the Supabase client (src/test/fake.ts), with its SYNTHETIC fixture rows, so the signed-in
 * Cockpit can be screenshotted and axe-checked without a real account. Reached only through the `resolve.alias` in
 * vite.config.ts when the dev server runs with COCKPIT_FAKE_DB=1 (launch config "cockpit-fake"); a production build
 * never sets it, so this file never ships. Open /?fake-role=pm (or admin) to see another role; the fake ignores RLS.
 */
import { createFake, fixtures } from "../test/fake";

const role = new URLSearchParams(location.search).get("fake-role");
const rows = fixtures();
// ?fake-role=pm|admin signs in the synthetic user with that role instead of owner.
if (role === "pm" || role === "admin") rows.profiles = rows.profiles.map((p) => ({ ...p, role }));
// ?fake-stop=2|5|6 shows the failed build as that stop case (the passing build is removed so the stop is current).
const CP = { lastCheckpoint: { path: "clients/x/sites/track-a/site.manifest.json", stage: "build", cycle: 1 } };
const STOPS: Record<string, { result: Record<string, unknown>; error: string }> = {
  "2": { result: { status: "failed_verification", qaIssues: ["[claims.unsourced-fact] The phone number 0400 111 222 on contact.html has no source in the brief."], ...CP }, error: "QA still failing after 2 revision(s)" },
  "5": { result: { status: "failed_verification", cycles: 3, qaIssues: ["[render.perf] LCP 4.1s on the Home page, on a mid-range phone.", "[seo.single-h1] /services has two page headings."], ...CP }, error: "QA still failing after 2 revision(s)" },
  "6": { result: { status: "build_failed", ...CP }, error: "spend:$5.00 ceiling of $5.00 reached before render.design-review" },
};
const stop = STOPS[new URLSearchParams(location.search).get("fake-stop") ?? ""];
if (stop) {
  rows.jobs = rows.jobs
    .filter((j) => j.id !== "44444444-4444-4444-8444-444444444444")
    .map((j) => (j.id === "33333333-3333-4333-8333-333333333333" ? { ...j, error: stop.error, result: { planId: "22222222-2222-4222-8222-222222222222", workflowRunId: "66666666-6666-4666-8666-666666666666", ...stop.result } } : j));
}
// ?fake-ph=1 gives the passing build a placeholder picture and two check results (the finished site review).
if (new URLSearchParams(location.search).get("fake-ph") === "1") {
  rows.jobs = rows.jobs.map((j) =>
    j.id === "44444444-4444-4444-8444-444444444444"
      ? { ...j, result: { ...(j.result as object), checks: [{ checkId: "render.perf", passed: true }, { checkId: "render.a11y", passed: true }], placeholders: [{ slot: "index.hero", page: "index", section: "hero", note: "A photo of a recent sign install" }] } }
      : j,
  );
}
// ?fake-activity=1 adds SYNTHETIC audit rows (a decision, a detail, a build request, a round of fixes, an account
// approval, and one yesterday) so the Activity room has person and factory events to show.
if (new URLSearchParams(location.search).get("fake-activity") === "1") {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const owner = "00000000-0000-4000-8000-0000000000aa";
  const pm = "00000000-0000-4000-8000-0000000000bb";
  const planA = "22222222-2222-4222-8222-222222222222";
  const run = "77777777-7777-4777-8777-777777777777";
  rows.profiles = [...rows.profiles, { id: pm, role: "pm", full_name: "Sample Applicant" }];
  rows.audit_log = [
    { id: "a1", occurred_at: ago(120), actor: owner, action: "plan.decision", task_id: planA, run_id: null, payload: { status: "approved", buildTrack: "A" } },
    { id: "a2", occurred_at: ago(110), actor: owner, action: "plan.input", task_id: planA, run_id: null, payload: { key: "phone", waived: false } },
    { id: "a3", occurred_at: ago(100), actor: owner, action: "job.requested", task_id: "44444444-4444-4444-8444-444444444444", run_id: null, payload: { kind: "build_plan", params: { planId: planA } } },
    { id: "a4", occurred_at: ago(99), actor: "worker", action: "job.run", task_id: "44444444-4444-4444-8444-444444444444", run_id: run, payload: {} },
    { id: "a5", occurred_at: ago(97), actor: "worker", action: "workflow.return_to_builder", task_id: null, run_id: run, payload: { cycle: 0 } },
    { id: "a6", occurred_at: ago(60), actor: owner, action: "account.approved", task_id: null, run_id: null, payload: { user_id: pm, role: "pm" } },
    { id: "a7", occurred_at: ago(60 * 26), actor: owner, action: "job.requested", task_id: null, run_id: null, payload: { kind: "intake" } },
  ];
}
// ?fake-costs=1 adds SYNTHETIC cost rows (six weeks of spend, two builds and their calls) for the Costs room.
if (new URLSearchParams(location.search).get("fake-costs") === "1") {
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const runV = "77777777-7777-4777-8777-777777777777";
  const runF = "66666666-6666-4666-8666-666666666666";
  const d = (n: number, model: string, priced: number, estimated = 0) => ({ day: day(n), entity_slug: "bennett-co", provider: model === "hermes-agent" ? "agent37" : "anthropic", model, calls: 6, input_tokens: 90_000, output_tokens: 9_000, priced_usd: priced, estimated_usd: estimated, unpriced_calls: 0, unpriced_input_tokens: 0, unpriced_output_tokens: 0 });
  rows.model_cost_by_day = [d(0, "claude-sonnet-5", 0.42), d(0, "hermes-agent", 0.9, 0.9), d(3, "claude-sonnet-5", 0.31), d(9, "claude-sonnet-5", 1.2), d(16, "hermes-agent", 2.1, 2.1), d(24, "claude-sonnet-5", 0.6), d(33, "claude-sonnet-5", 0.25)];
  const r = (run_id: string, priced: number, est: number, min: number) => ({ run_id, entity_slug: "bennett-co", calls: 4, errors: 0, input_tokens: 120_000, output_tokens: 12_000, priced_usd: priced, estimated_usd: est, unpriced_calls: 0, unpriced_input_tokens: 0, unpriced_output_tokens: 0, first_call_at: ago(min + 4), last_call_at: ago(min) });
  rows.model_cost_by_run = [r(runV, 0.71, 0.3, 96), r(runF, 1.12, 0.6, 178)];
  const t = (id: string, run_id: string | null, actor: string, model: string, cost: number, min: number) => ({ id, occurred_at: ago(min), run_id, actor, provider: model === "hermes-agent" ? "agent37" : "anthropic", model, entity_slug: "bennett-co", input_tokens: 30_000, output_tokens: 3_000, cost_usd: cost, price_basis: model === "hermes-agent" ? "estimated" : "metered", latency_ms: 20_000, outcome: "success" });
  rows.model_traces = [
    t("c1", runV, "agent:qa-evaluator", "claude-sonnet-5", 0.18, 96),
    t("c2", runV, "agent:front-end-builder", "hermes-agent", 0.3, 97),
    t("c3", runV, "agent:qa-evaluator", "claude-sonnet-5", 0.08, 98),
    t("c4", runV, "agent:front-end-builder", "claude-sonnet-5", 0.15, 99),
    t("c5", null, "hermes-lite", "claude-sonnet-5", 0.004, 120),
    t("c6", runF, "agent:front-end-builder", "hermes-agent", 0.6, 178),
    t("c7", runF, "agent:qa-evaluator", "claude-sonnet-5", 0.52, 179),
  ];
}
// ?fake-team=1 adds SYNTHETIC teammates (an admin, a PM with two clients, a PM with none) for Team and access.
if (new URLSearchParams(location.search).get("fake-team") === "1") {
  const pmA = "00000000-0000-4000-8000-0000000000dd";
  rows.profiles = [
    ...rows.profiles,
    { id: "00000000-0000-4000-8000-0000000000cc", role: "admin", full_name: "Alex Admin" },
    { id: pmA, role: "pm", full_name: "Sam Manager" },
    { id: "00000000-0000-4000-8000-0000000000ee", role: "pm", full_name: "Robin New" },
  ];
  rows.profile_clients = [
    { profile_id: pmA, client_id: "c1", clients: { name: "Harbor Street Bakery" } },
    { profile_id: pmA, client_id: "c2", clients: { name: "Summit Line Roofing" } },
  ];
  rows.account_requests = [...rows.account_requests, { user_id: pmA, email: "sam@example.test", full_name: "Sam Manager", status: "approved", requested_at: new Date(Date.now() - 9e6).toISOString(), decided_role: "pm", decision_note: null }];
}
const fake = createFake(rows);

const signedIn = {
  user: { id: "00000000-0000-4000-8000-0000000000aa", email: "owner@example.test" },
  access_token: "synthetic",
};

// App.tsx asks for a session and a profile; answer as a signed-in synthetic owner (or the role in ?fake-role=).
const auth = {
  ...fake.client.auth,
  getSession: async () => ({ data: { session: signedIn }, error: null }),
  getUser: async () => ({ data: { user: signedIn.user }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
};

export const supabase = { ...fake.client, auth } as unknown as typeof import("../supabaseClient").supabase;
