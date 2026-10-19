/**
 * Step 21 K: which business entity a piece of text is about, from the entity table (public.entities, migration 0028),
 * never from a list in code. Entity law (CLAUDE.md §5): N entities, never a fixed count.
 *
 * The list is read once per process with the service role (`loadEntities`) and passed to intake and Hermes-lite.
 * It never falls back to a built-in list: no table, no rows or a failed read is an error the caller surfaces.
 */
import { createClient } from "@supabase/supabase-js";

export interface KnownEntity {
  slug: string;
  /** Other ways a person writes the name, lower case ("bennett & co" for bennett-co). */
  aliases: string[];
}

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

/** The entity a text names, by slug or alias (case-insensitive). The longest match wins; null when none is named. */
export function detectEntitySlug(text: string, entities: readonly KnownEntity[]): string | null {
  const normalized = text.toLowerCase();
  let best: { slug: string; length: number } | null = null;
  for (const entity of entities) {
    for (const name of [entity.slug, ...entity.aliases]) {
      if (name && normalized.includes(name) && (!best || name.length > best.length)) best = { slug: entity.slug, length: name.length };
    }
  }
  return best?.slug ?? null;
}

/** Validates rows read from the table; a malformed row is an error, not skipped. */
export function entitiesFromRows(rows: unknown): KnownEntity[] {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("entities: the entity table returned no active entity");
  return rows.map((row, i) => {
    const r = row as { slug?: unknown; aliases?: unknown };
    if (typeof r.slug !== "string" || !SLUG_RE.test(r.slug)) throw new Error(`entities: row ${i} has no valid slug`);
    if (!Array.isArray(r.aliases) || r.aliases.some((a) => typeof a !== "string")) throw new Error(`entities: "${r.slug}" has malformed aliases`);
    return { slug: r.slug, aliases: (r.aliases as string[]).map((a) => a.toLowerCase()) };
  });
}

/** Reads the active entities with the service role. Throws with a plain cause when the table cannot be read. */
export async function loadEntities(env: NodeJS.ProcessEnv = process.env): Promise<KnownEntity[]> {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("entities: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed to read the entity table");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.from("entities").select("slug, aliases").eq("status", "active").order("slug");
  if (error) throw new Error(`entities: reading the entity table failed: ${error.message}`);
  return entitiesFromRows(data);
}
