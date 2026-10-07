/**
 * Service-role read of `public.plan_inputs` (migration 0018): the details an owner added to an approved plan after
 * it was approved. The newest row per key is the current one; a waived row means "build without it".
 */
import type { OwnerFact } from "@wfact/frontend-loop/brief";

export interface PlanInput {
  planId: string;
  kind: "fact" | "answer";
  key: string;
  label: string;
  value: string | null;
  waived: boolean;
  createdAt: string;
}

export interface PlanInputStore {
  /** The current input per key, oldest key first. */
  current(planId: string): Promise<PlanInput[]>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Newest row per key wins; input order is oldest first. */
export function currentInputs(rows: PlanInput[]): PlanInput[] {
  const byKey = new Map<string, PlanInput>();
  for (const r of [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) byKey.set(r.key, r);
  return [...byKey.values()];
}

/** What the builder may use: every non-waived value, as facts. */
export function ownerFactsFrom(inputs: PlanInput[]): OwnerFact[] {
  return inputs.filter((i) => !i.waived && i.value).map((i) => ({ key: i.key, label: i.label, value: i.value! }));
}

export class SupabasePlanInputStore implements PlanInputStore {
  private readonly endpoint: string;
  constructor(url: string, private readonly key: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.endpoint = `${url.replace(/\/+$/, "")}/rest/v1/plan_inputs`;
  }
  async current(planId: string): Promise<PlanInput[]> {
    if (!UUID.test(planId)) throw new Error(`plan id must be a UUID, got ${JSON.stringify(planId)}`);
    const res = await this.fetchImpl(`${this.endpoint}?plan_id=eq.${planId}&select=plan_id,kind,key,label,value,waived,created_at&order=created_at.asc`, {
      headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
    });
    if (!res.ok) throw new Error(`plan_inputs read failed (HTTP ${res.status})`);
    const rows = (await res.json()) as { plan_id: string; kind: "fact" | "answer"; key: string; label: string; value: string | null; waived: boolean; created_at: string }[];
    return currentInputs(rows.map((r) => ({ planId: r.plan_id, kind: r.kind, key: r.key, label: r.label, value: r.value, waived: r.waived, createdAt: r.created_at })));
  }
}

export class MemoryPlanInputStore implements PlanInputStore {
  readonly rows: PlanInput[] = [];
  async current(planId: string) {
    return currentInputs(this.rows.filter((r) => r.planId === planId));
  }
}
