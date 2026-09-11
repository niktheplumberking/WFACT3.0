/** Same pattern as `packages/frontend-loop/src/paths.ts` — resolve repo root from module location. */
import path from "node:path";
import { readdirSync } from "node:fs";

export function repoRoot(): string {
  // packages/verification/src -> repo root is three levels up.
  return path.resolve(import.meta.dirname, "..", "..", "..");
}

/** Every client slug under clients/, excluding the `_template` scaffold. */
export function knownClientSlugs(): string[] {
  const clientsDir = path.join(repoRoot(), "clients");
  try {
    return readdirSync(clientsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "_template")
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}
