/**
 * Where episodic entries are written: clients/<slug>/memory.md. The store has exactly two operations, read and
 * append. There is no write, replace or delete method, so the agent cannot rewrite history even by mistake; and every
 * append verifies afterwards that the file still starts with exactly what it held before (an append-only proof, not
 * a promise). Any failure throws, so the agent run escalates instead of silently skipping the entry.
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PermissionGate } from "@wfact/agent-runtime";
import { EPISODIC_LOG_HEADING, EPISODIC_LOG_PREAMBLE } from "@wfact/hermes-lite/tools/episodes";

/** The only files this store touches. */
export const MEMORY_PATH_RE = /^clients\/[a-z][a-z0-9-]*\/memory\.md$/;

export const memoryPathFor = (clientSlug: string): string => `clients/${clientSlug}/memory.md`;

export class MemoryWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryWriteError";
  }
}

export interface MemoryStore {
  /** The file's content, or null when it does not exist yet. */
  read(relPath: string): Promise<string | null>;
  /** Appends `text` at the end. Throws MemoryWriteError on any failure, including a detected rewrite. */
  append(relPath: string, text: string): Promise<{ bytesBefore: number; bytesAfter: number }>;
}

function assertMemoryPath(relPath: string): void {
  if (!MEMORY_PATH_RE.test(relPath)) throw new MemoryWriteError(`memory path ${JSON.stringify(relPath)} is not clients/<slug>/memory.md`);
}

/**
 * The text to append for a set of entry blocks: the episodic-log heading first if the file has none yet (it then
 * becomes the file's last section, so later entries land under it), separated from what is there by a blank line.
 */
export function appendChunk(existing: string | null, clientSlug: string, blocks: string[]): string {
  let prefix = "";
  let base = existing ?? "";
  if (existing === null) {
    prefix = `# Client: ${clientSlug}\n\n_Created by the documentation agent: no memory file existed for this client._\n`;
    base = prefix;
  }
  const sep = base.length === 0 ? "" : base.endsWith("\n\n") ? "" : base.endsWith("\n") ? "\n" : "\n\n";
  const heading = base.includes(`\n${EPISODIC_LOG_HEADING}\n`) || base.startsWith(`${EPISODIC_LOG_HEADING}\n`) ? "" : `${EPISODIC_LOG_HEADING}\n\n${EPISODIC_LOG_PREAMBLE}\n\n`;
  return `${prefix}${sep}${heading}${blocks.join("\n")}`;
}

/** The repo's own files (local runs and the CLIs). */
export class FileMemoryStore implements MemoryStore {
  constructor(private readonly root: string) {}

  async read(relPath: string): Promise<string | null> {
    assertMemoryPath(relPath);
    try {
      return readFileSync(path.join(this.root, relPath), "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new MemoryWriteError(`cannot read ${relPath}: ${String(err)}`);
    }
  }

  async append(relPath: string, text: string): Promise<{ bytesBefore: number; bytesAfter: number }> {
    assertMemoryPath(relPath);
    const abs = path.join(this.root, relPath);
    const before = await this.read(relPath);
    try {
      mkdirSync(path.dirname(abs), { recursive: true });
      // flag "a": O_APPEND, the OS writes at the end whatever else happened to the file.
      appendFileSync(abs, text, { encoding: "utf-8", flag: "a" });
    } catch (err) {
      throw new MemoryWriteError(`cannot append to ${relPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
    const after = (await this.read(relPath)) ?? "";
    if (!after.startsWith(before ?? "")) {
      throw new MemoryWriteError(`append-only check failed for ${relPath}: the file no longer starts with its previous content`);
    }
    return { bytesBefore: Buffer.byteLength(before ?? "", "utf8"), bytesAfter: Buffer.byteLength(after, "utf8") };
  }
}

/** For tests: an in-memory map with the same contract (and a switch to make appends fail). */
export class InMemoryMemoryStore implements MemoryStore {
  readonly files = new Map<string, string>();
  failAppends: string | null = null;
  readonly appends: { path: string; text: string }[] = [];

  async read(relPath: string): Promise<string | null> {
    assertMemoryPath(relPath);
    return this.files.get(relPath) ?? null;
  }

  async append(relPath: string, text: string): Promise<{ bytesBefore: number; bytesAfter: number }> {
    assertMemoryPath(relPath);
    if (this.failAppends) throw new MemoryWriteError(this.failAppends);
    const before = this.files.get(relPath) ?? "";
    this.files.set(relPath, before + text);
    this.appends.push({ path: relPath, text });
    return { bytesBefore: Buffer.byteLength(before, "utf8"), bytesAfter: Buffer.byteLength(before + text, "utf8") };
  }
}

/** Every read and append first asks the agent's gate (fs:read / fs:write of that exact path). */
export function gatedMemoryStore(store: MemoryStore, gate: PermissionGate): MemoryStore {
  return {
    read: async (relPath) => {
      await gate.authorize({ kind: "fs", op: "read", path: relPath });
      return store.read(relPath);
    },
    append: async (relPath, text) => {
      await gate.authorize({ kind: "fs", op: "write", path: relPath });
      return store.append(relPath, text);
    },
  };
}
