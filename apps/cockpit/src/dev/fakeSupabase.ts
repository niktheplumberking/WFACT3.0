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
