/**
 * Server-side access to `public.plan_approvals` (packages/db/migrations/0007_plan_approvals.sql).
 * The pipeline inserts pending plans and can supersede a pending one with a re-plan; it can NEVER
 * approve or reject — the table's trigger refuses a decision without a signed-in human, so the owner
 * gate holds even if this code were wrong. Approvals happen in the Cockpit's Approvals room.
 */
import type { IntakeResult } from "./intake.js";
import type { Plan } from "./planner.js";

export type PlanStatus = "pending" | "approved" | "rejected" | "superseded";

export interface StoredPlan {
  id: string;
  createdAt: string;
  status: PlanStatus;
  revision: number;
  supersedes: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  plan: Plan;
  intake: IntakeResult;
}

export interface PlanStore {
  insertPending(args: { plan: Plan; intake: IntakeResult; revision: 1 | 2; supersedes: string | null; intakeRunId: string | null }): Promise<string>;
  get(id: string): Promise<StoredPlan | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string; created_at: string; status: PlanStatus; revision: number; supersedes: string | null;
  decision_note: string | null; decided_at: string | null; plan: { plan: Plan; intake: IntakeResult };
};

export class SupabasePlanStore implements PlanStore {
  private readonly endpoint: string;
  constructor(url: string, private readonly key: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.endpoint = `${url.replace(/\/+$/, "")}/rest/v1/plan_approvals`;
  }

  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...extra };
  }

  async insertPending({ plan, intake, revision, supersedes, intakeRunId }: Parameters<PlanStore["insertPending"]>[0]): Promise<string> {
    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: this.headers({ Prefer: "return=representation" }),
      body: JSON.stringify({
        client_slug: plan.brief.clientSlug,
        entity_slug: plan.brief.entitySlug,
        plan: { plan, intake },
        revision,
        supersedes,
        intake_run_id: intakeRunId,
      }),
    });
    if (!res.ok) throw new Error(`plan_approvals insert failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
    const [row] = (await res.json()) as Row[];
    if (!row) throw new Error("plan_approvals insert returned no row");
    if (supersedes) {
      // Only a still-pending predecessor flips to superseded; a rejected one is final and stays rejected
      // (the status filter means the trigger never even sees it).
      const sup = await this.fetchImpl(`${this.endpoint}?id=eq.${supersedes}&status=eq.pending`, {
        method: "PATCH",
        headers: this.headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ status: "superseded" }),
      });
      if (!sup.ok) throw new Error(`superseding ${supersedes} failed (HTTP ${sup.status})`);
    }
    return row.id;
  }

  async get(id: string): Promise<StoredPlan | null> {
    if (!UUID.test(id)) throw new Error(`plan id must be a UUID, got ${JSON.stringify(id)}`);
    const res = await this.fetchImpl(`${this.endpoint}?id=eq.${id}&select=*`, { headers: this.headers() });
    if (!res.ok) throw new Error(`plan_approvals read failed (HTTP ${res.status})`);
    const [row] = (await res.json()) as Row[];
    return row ? toStored(row) : null;
  }
}

function toStored(r: Row): StoredPlan {
  return {
    id: r.id, createdAt: r.created_at, status: r.status, revision: r.revision, supersedes: r.supersedes,
    decisionNote: r.decision_note, decidedAt: r.decided_at, plan: r.plan.plan, intake: r.plan.intake,
  };
}

/** For tests — mirrors the table's rules that matter to the pipeline (it can't decide). */
export class MemoryPlanStore implements PlanStore {
  readonly rows = new Map<string, StoredPlan>();
  async insertPending({ plan, intake, revision, supersedes }: Parameters<PlanStore["insertPending"]>[0]): Promise<string> {
    const id = crypto.randomUUID();
    this.rows.set(id, {
      id, createdAt: new Date().toISOString(), status: "pending", revision, supersedes,
      decisionNote: null, decidedAt: null, plan: structuredClone(plan), intake: structuredClone(intake),
    });
    const prev = supersedes ? this.rows.get(supersedes) : undefined;
    if (prev && prev.status === "pending") prev.status = "superseded";
    return id;
  }
  async get(id: string): Promise<StoredPlan | null> {
    return structuredClone(this.rows.get(id) ?? null);
  }
  /** Test-only stand-in for the human decision the Cockpit makes. */
  decide(id: string, status: "approved" | "rejected", note: string | null = null): void {
    const row = this.rows.get(id);
    if (!row || row.status !== "pending") throw new Error("only a pending plan can be decided");
    row.status = status;
    row.decisionNote = note;
    row.decidedAt = new Date().toISOString();
  }
}

export function planStoreFromEnv(env: NodeJS.ProcessEnv = process.env): { store: PlanStore | null; reason: string | null } {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { store: null, reason: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed to write plans for owner approval." };
  }
  return { store: new SupabasePlanStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY), reason: null };
}
