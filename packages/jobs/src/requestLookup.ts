/**
 * Build-quality Package 1 fallback: plans written before 2026-10-14 do not carry the client's request. The request is still
 * on file as the intake job's `params.text` (jobs table, migration 0009; immutable after insert). This finds it: follow the
 * plan's `supersedes` chain back to the first plan, then the intake job whose result names that plan. Service role only.
 */
import type { PlanStore } from "@wfact/planning/planStore";

export interface RequestTextLookup {
  /** The raw request text behind a plan, or null when none can be found. */
  requestTextFor(planId: string): Promise<string | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A plan chain is at most an intake plan, one re-plan and direction re-runs; the cap only stops a cycle. */
const MAX_CHAIN = 8;

export async function rootPlanId(planId: string, plans: PlanStore): Promise<string> {
  let id = planId;
  for (let i = 0; i < MAX_CHAIN; i += 1) {
    const p = await plans.get(id);
    if (!p?.supersedes) return id;
    id = p.supersedes;
  }
  return id;
}

export class SupabaseRequestLookup implements RequestTextLookup {
  private readonly endpoint: string;
  constructor(url: string, private readonly key: string, private readonly plans: PlanStore, private readonly fetchImpl: typeof fetch = fetch) {
    this.endpoint = `${url.replace(/\/+$/, "")}/rest/v1/jobs`;
  }
  async requestTextFor(planId: string): Promise<string | null> {
    if (!UUID.test(planId)) return null;
    const root = await rootPlanId(planId, this.plans);
    const res = await this.fetchImpl(`${this.endpoint}?kind=eq.intake&result->>planId=eq.${root}&select=params&limit=1`, {
      headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
    });
    if (!res.ok) throw new Error(`jobs read for the plan's request failed (HTTP ${res.status})`);
    const [row] = (await res.json()) as { params: { text?: unknown } }[];
    return typeof row?.params?.text === "string" && row.params.text.trim() ? row.params.text : null;
  }
}
