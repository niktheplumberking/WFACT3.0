/**
 * Test double for the Supabase client: serves SYNTHETIC fixture rows and records every write, RPC and
 * function call so tests can assert exactly what the Cockpit asked the database to do. It does not
 * imitate RLS; RLS is proven by the SQL attack tests (scripts/rls_attack_test*.sql), not here.
 */
type Row = Record<string, unknown>;

export interface Call {
  op: "insert" | "update" | "rpc" | "invoke" | "signOut";
  table?: string;
  values?: unknown;
  filters?: [string, unknown][];
  name?: string;
  args?: unknown;
}

export function createFake(tables: Record<string, Row[]>) {
  const calls: Call[] = [];
  let nextId = 1;

  function query(table: string) {
    let rows = [...(tables[table] ?? [])];
    let mode: "select" | "insert" | "update" = "select";
    let values: unknown = null;
    let single: "maybe" | "one" | null = null;
    const filters: [string, unknown][] = [];
    const api = {
      select: () => api,
      eq: (k: string, v: unknown) => {
        filters.push([k, v]);
        rows = rows.filter((r) => r[k] === undefined || r[k] === v);
        return api;
      },
      in: (k: string, v: unknown[]) => {
        rows = rows.filter((r) => v.includes(r[k]));
        return api;
      },
      order: () => api,
      limit: (n: number) => {
        rows = rows.slice(0, n);
        return api;
      },
      maybeSingle: () => {
        single = "maybe";
        return api;
      },
      single: () => {
        single = "one";
        return api;
      },
      insert: (v: unknown) => {
        mode = "insert";
        values = v;
        return api;
      },
      update: (v: unknown) => {
        mode = "update";
        values = v;
        return api;
      },
      then: (resolve: (r: unknown) => void) => {
        if (mode === "insert") {
          calls.push({ op: "insert", table, values });
          const row = { id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}` };
          return resolve({ data: single ? row : [row], error: null });
        }
        if (mode === "update") {
          calls.push({ op: "update", table, values, filters });
          return resolve({ data: rows.map((r) => ({ id: r.id })), error: null });
        }
        return resolve({ data: single ? (rows[0] ?? null) : rows, error: null });
      },
    };
    return api;
  }

  const client = {
    from: query,
    rpc: async (name: string, args: unknown) => {
      calls.push({ op: "rpc", name, args });
      return { error: null };
    },
    functions: {
      invoke: async (name: string, args: unknown) => {
        calls.push({ op: "invoke", name, args });
        return { error: null };
      },
    },
    storage: { from: () => ({ download: async () => ({ data: null, error: { message: "no storage in tests" } }) }) },
    auth: {
      getUser: async () => ({ data: { user: { id: OWNER_ID } } }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {
        calls.push({ op: "signOut" });
        return {};
      },
    },
  };
  return { client, calls };
}

/* ---------------- synthetic fixtures (shaped like the live rows of 2026-10-01) ---------------- */

export const OWNER_ID = "00000000-0000-4000-8000-0000000000aa";
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export const PLAN_PENDING = "11111111-1111-4111-8111-111111111111";
export const PLAN_APPROVED = "22222222-2222-4222-8222-222222222222";
export const JOB_FAILED = "33333333-3333-4333-8333-333333333333";
export const JOB_VERIFIED = "44444444-4444-4444-8444-444444444444";
export const JOB_STUCK = "55555555-5555-4555-8555-555555555555";
export const RUN_FAILED = "66666666-6666-4666-8666-666666666666";

function plan(id: string, status: string, extra: Row = {}): Row {
  return {
    id,
    created_at: ago(300),
    client_slug: "summit-line-roofing",
    entity_slug: "bennett-co",
    status,
    revision: 1,
    decision_note: null,
    decided_at: status === "pending" ? null : ago(200),
    build_track: null,
    track_overridden: null,
    plan: {
      plan: {
        templateId: "clean-agency",
        templateRationale: "A restrained, high-trust layout for a trade company.",
        brief: { projectName: "Summit Line Roofing Website", goal: "Explain services and pricing basics so fewer people phone to ask.", requiredSections: ["hero", "services", "contact"] },
        tasks: [{ order: 1, role: "front-end-builder", stage: "4_homepage_build", title: "Build the homepage" }],
        risks: ["Pricing strategy is undecided."],
        openQuestions: ["Fixed prices or from-prices?", "Booking: form or phone?", "Years in business?", "Can we use the reviews?", "Logo?", "Domain?"],
        intake: { entitySlug: "bennett-co", leadType: "new_website", clientName: "Summit Line Roofing", requestSource: "intake-raw" },
      },
      direction: {
        niche: "local_trade",
        nicheLabel: "Local trade",
        nicheQuote: "a small roofing and gutter company",
        audience: { point: "Older customers on phones", quote: "Lots of our customers are older" },
        primaryGoal: "booking",
        goalQuote: "book an inspection online",
        requirements: [{ point: "List of services", quote: "repairs, replacements" }],
        constraints: [{ point: "Fast on poor signal", quote: "the signal is bad out here" }],
        brandDirection: [{ aspect: "tone", point: "Solid, not flashy", quote: "solid and trustworthy, not flashy" }],
        recommendation: { track: "A", confidence: 0.88, reasons: ["A small local company."], withheldReason: null },
        openQuestions: [],
        unsupported: [],
      },
    },
    ...extra,
  };
}

function job(id: string, kind: string, status: string, extra: Row = {}): Row {
  return { id, created_at: ago(240), kind, params: {}, status, started_at: null, finished_at: null, result: null, error: null, gh_run_url: null, archived_at: null, ...extra };
}

export function fixtures(): Record<string, Row[]> {
  return {
    profiles: [{ id: OWNER_ID, role: "owner", full_name: "Test Owner" }],
    plan_approvals: [plan(PLAN_PENDING, "pending"), plan(PLAN_APPROVED, "approved", { build_track: "A", track_overridden: false })],
    jobs: [
      job(JOB_STUCK, "build_plan", "queued", { params: { planId: PLAN_APPROVED }, created_at: ago(3000) }),
      job(JOB_VERIFIED, "build_plan", "succeeded", {
        params: { planId: PLAN_APPROVED },
        created_at: ago(100),
        started_at: ago(99),
        finished_at: ago(95),
        result: { status: "awaiting_launch_approval", planId: PLAN_APPROVED, workflowRunId: "77777777-7777-4777-8777-777777777777", cycles: 1, builderRounds: [{ round: 1, verdict: "changes_requested", issues: ["Body text too light."] }], qaIssues: [] },
      }),
      job(JOB_FAILED, "build_plan", "failed", {
        params: { planId: PLAN_APPROVED },
        created_at: ago(180),
        started_at: ago(179),
        finished_at: ago(177),
        result: { status: "build_failed", planId: PLAN_APPROVED, workflowRunId: RUN_FAILED, cycles: 0, builderRounds: [], qaIssues: [] },
        error: 'builder escalated: Agent 37 reported failure: HTTP 402: {"error":"AI credits exhausted."}',
        gh_run_url: "https://github.com/example/actions/runs/1",
      }),
    ],
    account_requests: [{ user_id: "00000000-0000-4000-8000-0000000000bb", email: "new.pm@example.test", full_name: "Sample Applicant", status: "pending", requested_at: ago(60), decided_role: null, decision_note: null }],
    projects: [
      { id: "proj-6", name: "DreamSign homepage", stage: "6_full_build_owners_key", status: "active", created_at: ago(9000), clients: { name: "DreamSign (pilot)", entities: { name: "DreamSign" } } },
      { id: "proj-7", name: "Harbor bakery site", stage: "7_qa_security", status: "active", created_at: ago(8000), clients: { name: "Harbor Street Bakery", entities: { name: "Bennett & Co" } } },
    ],
    correction_rounds: [],
    entities: [{ id: "ent-1", slug: "bennett-co", name: "Bennett & Co", status: "active" }],
    clients: [],
    model_usage_by_actor: [],
    model_traces: [],
  };
}
