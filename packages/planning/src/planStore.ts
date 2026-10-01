/**
 * Server-side access to `public.plan_approvals` (packages/db/migrations/0007_plan_approvals.sql).
 * The pipeline inserts pending plans and can supersede a pending one with a re-plan; it can NEVER
 * approve or reject — the table's trigger refuses a decision without a signed-in human, so the owner
 * gate holds even if this code were wrong. Approvals happen in the Cockpit's Approvals room.
 */
import type { IntakeResult } from "./intake.js";
import type { Plan } from "./planner.js";
import type { DirectionResult } from "./direction.js";

export type BuildTrack = "A" | "B";

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
  /** Step 4B M2: direction summary + track recommendation stored with the plan (null if the step did not run). */
  direction: DirectionResult | null;
  directionNote: string | null;
  /** The owner's track choice, set only with an approval (migration 0011); null before that. */
  buildTrack: BuildTrack | null;
  /** Set by the database at approval: true = owner overrode the recommendation, null = there was none. */
  trackOverridden: boolean | null;
}

export interface InsertPendingArgs {
  plan: Plan;
  intake: IntakeResult;
  revision: 1 | 2;
  supersedes: string | null;
  intakeRunId: string | null;
  direction?: DirectionResult | null;
  directionNote?: string | null;
}

export interface PlanStore {
  insertPending(args: InsertPendingArgs): Promise<string>;
  get(id: string): Promise<StoredPlan | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string; created_at: string; status: PlanStatus; revision: number; supersedes: string | null;
  decision_note: string | null; decided_at: string | null;
  plan: { plan: Plan; intake: IntakeResult; direction?: DirectionResult | null; directionNote?: string | null };
  build_track?: BuildTrack | null; track_overridden?: boolean | null;
};

export class SupabasePlanStore implements PlanStore {
  private readonly endpoint: string;
  constructor(url: string, private readonly key: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.endpoint = `${url.replace(/\/+$/, "")}/rest/v1/plan_approvals`;
  }

  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...extra };
  }

  async insertPending({ plan, intake, revision, supersedes, intakeRunId, direction = null, directionNote = null }: InsertPendingArgs): Promise<string> {
    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: this.headers({ Prefer: "return=representation" }),
      body: JSON.stringify({
        client_slug: plan.brief.clientSlug,
        entity_slug: plan.brief.entitySlug,
        plan: { plan, intake, direction, directionNote },
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
    direction: r.plan.direction ?? null, directionNote: r.plan.directionNote ?? null,
    buildTrack: r.build_track ?? null, trackOverridden: r.track_overridden ?? null,
  };
}

/** For tests — mirrors the table's rules that matter to the pipeline (it can't decide). */
export class MemoryPlanStore implements PlanStore {
  readonly rows = new Map<string, StoredPlan>();
  async insertPending({ plan, intake, revision, supersedes, direction = null, directionNote = null }: InsertPendingArgs): Promise<string> {
    const id = crypto.randomUUID();
    this.rows.set(id, {
      id, createdAt: new Date().toISOString(), status: "pending", revision, supersedes,
      decisionNote: null, decidedAt: null, plan: structuredClone(plan), intake: structuredClone(intake),
      direction: structuredClone(direction), directionNote, buildTrack: null, trackOverridden: null,
    });
    const prev = supersedes ? this.rows.get(supersedes) : undefined;
    if (prev && prev.status === "pending") prev.status = "superseded";
    return id;
  }
  async get(id: string): Promise<StoredPlan | null> {
    return structuredClone(this.rows.get(id) ?? null);
  }
  /**
   * Test-only stand-in for the human decision the Cockpit makes. Mirrors migration 0011: an approval
   * needs a track, a rejection must not carry one, and `trackOverridden` is derived, never supplied.
   */
  decide(id: string, status: "approved" | "rejected", note: string | null = null, track: BuildTrack | null = null): void {
    const row = this.rows.get(id);
    if (!row || row.status !== "pending") throw new Error("only a pending plan can be decided");
    if (status === "approved" && !track) throw new Error("an approval needs a build track (A or B)");
    if (status === "rejected" && track) throw new Error("a rejection does not choose a track");
    row.status = status;
    row.decisionNote = note;
    row.decidedAt = new Date().toISOString();
    row.buildTrack = track;
    const rec = row.direction?.recommendation.track ?? null;
    row.trackOverridden = status === "approved" ? (rec === null ? null : rec !== track) : null;
  }
}

export function planStoreFromEnv(env: NodeJS.ProcessEnv = process.env): { store: PlanStore | null; reason: string | null } {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { store: null, reason: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed to write plans for owner approval." };
  }
  return { store: new SupabasePlanStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY), reason: null };
}
