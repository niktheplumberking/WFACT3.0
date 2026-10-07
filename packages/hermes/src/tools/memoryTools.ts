/**
 * The two memory-read tools Hermes-lite is allowed to call. Both are read-only and both refuse
 * to resolve outside the repo's memory/clients directories — a model's own output can supply a
 * client slug, so path traversal is treated as an attack surface, not a hypothetical.
 */
import { readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ToolDefinition } from "./schema.js";
import { parseEpisodes, type Episode } from "./episodes.js";

// Matches the naming convention clients/_template/memory.md documents (a directory per client).
// Deliberately excludes "_template" itself — that file is a form, not a client's memory.
const CLIENT_SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

export function repoRoot(): string {
  // packages/hermes/src/tools -> repo root is four levels up.
  return path.resolve(import.meta.dirname, "..", "..", "..", "..");
}

const readContextInput = z.object({});
const readContextOutput = z.object({
  content: z.string(),
  path: z.string(),
});

export const readContextTool: ToolDefinition<typeof readContextInput, typeof readContextOutput> = {
  name: "memory.readContext",
  description: "Read memory/context.md — the business-wide memory file. Read-only, no arguments.",
  inputSchema: readContextInput,
  outputSchema: readContextOutput,
  handler: async () => {
    const filePath = path.join(repoRoot(), "memory", "context.md");
    const content = await readFile(filePath, "utf8");
    return { content, path: path.relative(repoRoot(), filePath) };
  },
};

const readClientInput = z.object({
  clientSlug: z
    .string()
    .regex(CLIENT_SLUG_PATTERN, "clientSlug must be a lowercase-hyphen directory name, no path segments"),
});
const readClientOutput = z.object({
  found: z.boolean(),
  content: z.string().nullable(),
  path: z.string(),
  /**
   * Step 5: the structured episodic entries the Documentation agent appended to this file, parsed and validated
   * (packages/hermes/src/tools/episodes.ts). Entries that fail validation or were edited by hand are NOT here;
   * they are listed in `episodeProblems` instead, so a status answer never rests on a tampered record.
   */
  episodes: z.array(z.custom<Episode>((v) => typeof v === "object" && v !== null)),
  episodeProblems: z.array(z.object({ line: z.number(), entryId: z.string().nullable(), problem: z.string() })),
});

export const readClientMemoryTool: ToolDefinition<typeof readClientInput, typeof readClientOutput> = {
  name: "memory.readClient",
  description:
    "Read clients/<clientSlug>/memory.md for one client. Read-only. clientSlug is validated " +
    "against a strict pattern before touching the filesystem, so it can never escape the clients/ dir.",
  inputSchema: readClientInput,
  outputSchema: readClientOutput,
  handler: async ({ clientSlug }) => {
    if (clientSlug === "_template") {
      // The template is a form for humans to copy, not a client's actual memory — never let a
      // status question accidentally answer itself from the blank template.
      return { found: false, content: null, path: "clients/_template/memory.md", episodes: [], episodeProblems: [] };
    }
    const clientsDir = path.join(repoRoot(), "clients");
    const filePath = path.join(clientsDir, clientSlug, "memory.md");
    // Defense in depth: even though the regex above already forbids "..\" and "/", confirm the
    // resolved path still lives under clients/ before reading it.
    const relative = path.relative(clientsDir, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Refusing to read outside clients/: resolved path was "${filePath}"`);
    }
    try {
      const content = await readFile(filePath, "utf8");
      const { episodes, problems } = parseEpisodes(content);
      return { found: true, content, path: path.relative(repoRoot(), filePath), episodes, episodeProblems: problems };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { found: false, content: null, path: path.relative(repoRoot(), filePath), episodes: [], episodeProblems: [] };
      }
      throw err;
    }
  },
};

/**
 * Step 5: the client folders that exist (directory names under clients/, never `_template` or dotfiles), so the
 * controller can recognise "Summit Line Roofing" in a question as the `summit-line-roofing` client. Names only:
 * no file is opened here, and the memory itself is still read only through the allowlisted, gated tool.
 */
export function listClientSlugs(root: string = repoRoot()): string[] {
  const dir = path.join(root, "clients");
  try {
    return readdirSync(dir)
      .filter((name) => CLIENT_SLUG_PATTERN.test(name) && statSync(path.join(dir, name)).isDirectory())
      .sort();
  } catch {
    return [];
  }
}
