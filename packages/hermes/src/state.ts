/**
 * Read-only access to the state layer (Supabase, packages/db). Hermes never calls Supabase
 * directly from the tool handler — it goes through this narrow StateReader interface so the
 * production Supabase-backed reader and a test fixture reader are interchangeable, and so the
 * tool schema (tools/stateTools.ts) is the only thing that ever sees the query shape.
 *
 * Per CLAUDE.md §6, Hermes decides, it doesn't act — this reader is intentionally SELECT-only
 * and has no write path at all, not even one that's currently unused.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface ProjectStatusRow {
  entitySlug: string;
  clientName: string;
  projectName: string;
  stage: string;
  status: string;
  updatedAt: string;
}

export interface StateReader {
  /** All projects under one entity (e.g. "dreamsign"). Empty array if the entity has none. */
  getProjectStatuses(entitySlug: string): Promise<ProjectStatusRow[]>;
}

export class SupabaseStateReader implements StateReader {
  private readonly client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  async getProjectStatuses(entitySlug: string): Promise<ProjectStatusRow[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("name, stage, status, updated_at, clients(name), entities!inner(slug)")
      .eq("entities.slug", entitySlug);

    if (error) {
      throw new Error(`Supabase query failed for entity "${entitySlug}": ${error.message}`);
    }

    type Row = {
      name: string;
      stage: string;
      status: string;
      updated_at: string;
      clients: { name: string } | { name: string }[] | null;
    };

    return ((data ?? []) as Row[]).map((row) => {
      const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
      return {
        entitySlug,
        clientName: client?.name ?? "(unknown client)",
        projectName: row.name,
        stage: row.stage,
        status: row.status,
        updatedAt: row.updated_at,
      };
    });
  }
}

/**
 * Build a SupabaseStateReader from env vars, or return null with a clear reason if they're not
 * set — per BLOCKED-ON-NICK.md, SUPABASE_SERVICE_ROLE_KEY isn't provisioned in any real .env yet.
 * Never falls back to a fabricated reader; callers must handle the null case explicitly.
 */
export function stateReaderFromEnv(env: NodeJS.ProcessEnv = process.env): {
  reader: StateReader | null;
  reason: string | null;
} {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return {
      reader: null,
      reason:
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are not set — see " +
        ".env.example and BLOCKED-ON-NICK.md. Hermes-lite will not guess at state.",
    };
  }
  return { reader: new SupabaseStateReader(url, key), reason: null };
}
