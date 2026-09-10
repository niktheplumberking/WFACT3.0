/**
 * The two memory-read tools Hermes-lite is allowed to call. Both are read-only and both refuse
 * to resolve outside the repo's memory/clients directories — a model's own output can supply a
 * client slug, so path traversal is treated as an attack surface, not a hypothetical.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ToolDefinition } from "./schema.js";

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
      return { found: false, content: null, path: "clients/_template/memory.md" };
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
      return { found: true, content, path: path.relative(repoRoot(), filePath) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { found: false, content: null, path: path.relative(repoRoot(), filePath) };
      }
      throw err;
    }
  },
};
