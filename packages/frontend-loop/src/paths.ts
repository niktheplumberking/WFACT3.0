/**
 * Same pattern as `packages/hermes/src/tools/memoryTools.ts`'s `repoRoot()`: resolve the repo
 * root from this module's own location rather than trusting `process.cwd()`, so path handling
 * stays correct whether this package is run from the repo root or from inside
 * `packages/frontend-loop` (both are real invocation patterns — `npm run build-page` is typically
 * run from this package's own directory).
 */
import path from "node:path";

export function repoRoot(): string {
  // packages/frontend-loop/src -> repo root is three levels up.
  return path.resolve(import.meta.dirname, "..", "..", "..");
}
