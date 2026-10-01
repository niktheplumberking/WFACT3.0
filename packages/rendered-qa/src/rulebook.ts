/** Loads and shape-checks the design rulebook (packages/frontend-loop/design/rulebook.json). */
import { readFileSync } from "node:fs";
import path from "node:path";

export interface RulebookRule {
  id: string;
  kind: "banned" | "required";
  title: string;
  rule: string;
  detect: { dom?: string; review?: string };
  briefCanAllow: boolean;
  fixture: string;
}
export interface Rulebook {
  version: string;
  rules: RulebookRule[];
}

export const RULEBOOK_PATH = path.resolve(import.meta.dirname, "..", "..", "frontend-loop", "design", "rulebook.json");

export function loadRulebook(file: string = RULEBOOK_PATH): Rulebook {
  const raw = JSON.parse(readFileSync(file, "utf-8")) as Rulebook;
  if (typeof raw.version !== "string" || !Array.isArray(raw.rules) || raw.rules.length === 0) throw new Error(`${file}: not a rulebook`);
  const ids = new Set<string>();
  for (const r of raw.rules) {
    if (!/^D[RQ]-[A-Z0-9-]+$/.test(r.id) || ids.has(r.id)) throw new Error(`${file}: bad or duplicate rule id ${r.id}`);
    ids.add(r.id);
    if (!r.detect?.dom && !r.detect?.review) throw new Error(`${file}: rule ${r.id} has no way to be detected`);
    if (!r.fixture) throw new Error(`${file}: rule ${r.id} has no failing fixture`);
  }
  return raw;
}
