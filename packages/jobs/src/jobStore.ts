/**
 * Service-role access to `public.jobs` (migration 0009) for the GitHub Actions runner. The database
 * trigger enforces the rules (request immutable, status forward-only, no deletes) — this class only
 * reads a job and records progress/results.
 */
export type JobKind = "intake" | "replan" | "build_plan" | "resume" | "verify" | "ask";
export type JobStatus = "queued" | "dispatched" | "running" | "succeeded" | "failed";

export interface Job {
  id: string;
  kind: JobKind;
  params: Record<string, unknown>;
  status: JobStatus;
  createdBy: string;
}

export interface JobStore {
  get(id: string): Promise<Job | null>;
  markRunning(id: string, ghRunUrl: string | null): Promise<void>;
  finish(id: string, outcome: { status: "succeeded" | "failed"; result: unknown; error: string | null }): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SupabaseJobStore implements JobStore {
  private readonly endpoint: string;
  constructor(url: string, private readonly key: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.endpoint = `${url.replace(/\/+$/, "")}/rest/v1/jobs`;
  }
  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...extra };
  }
  async get(id: string): Promise<Job | null> {
    if (!UUID.test(id)) throw new Error(`job id must be a UUID, got ${JSON.stringify(id)}`);
    const res = await this.fetchImpl(`${this.endpoint}?id=eq.${id}&select=id,kind,params,status,created_by`, { headers: this.headers() });
    if (!res.ok) throw new Error(`jobs read failed (HTTP ${res.status})`);
    const [row] = (await res.json()) as { id: string; kind: JobKind; params: Record<string, unknown>; status: JobStatus; created_by: string }[];
    return row ? { id: row.id, kind: row.kind, params: row.params, status: row.status, createdBy: row.created_by } : null;
  }
  private async patch(id: string, body: Record<string, unknown>): Promise<void> {
    const res = await this.fetchImpl(`${this.endpoint}?id=eq.${id}`, {
      method: "PATCH",
      headers: this.headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`jobs update failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  markRunning(id: string, ghRunUrl: string | null) {
    return this.patch(id, { status: "running", started_at: new Date().toISOString(), gh_run_url: ghRunUrl });
  }
  finish(id: string, o: { status: "succeeded" | "failed"; result: unknown; error: string | null }) {
    return this.patch(id, { status: o.status, result: o.result ?? null, error: o.error, finished_at: new Date().toISOString() });
  }
}

export class MemoryJobStore implements JobStore {
  readonly rows = new Map<string, Job & { result?: unknown; error?: string | null; ghRunUrl?: string | null }>();
  async get(id: string) {
    const r = this.rows.get(id);
    return r ? { id: r.id, kind: r.kind, params: r.params, status: r.status, createdBy: r.createdBy } : null;
  }
  async markRunning(id: string, ghRunUrl: string | null) {
    const r = this.rows.get(id)!;
    r.status = "running";
    r.ghRunUrl = ghRunUrl;
  }
  async finish(id: string, o: { status: "succeeded" | "failed"; result: unknown; error: string | null }) {
    const r = this.rows.get(id)!;
    if (r.status === "succeeded" || r.status === "failed") throw new Error("job already finished");
    r.status = o.status;
    r.result = o.result;
    r.error = o.error;
  }
}
