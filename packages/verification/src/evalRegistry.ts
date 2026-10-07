/**
 * The evaluation registry (Factory Completion Plan Step 7; Blueprint §14): versioned data
 * (config/eval-registry.json) plus the code that runs it. The data says, for every check, its ID, category,
 * severity, mode, runner, stage, what it proves, where it came from, which model (if any) it uses, and its
 * passing and broken fixtures. This module validates that data against the code on load (no orphan check in
 * either direction, no reasonless entry) and derives the deterministic text gate every entry point runs.
 *
 * Gate semantics:
 *   - blocker and major failures fail the gate (failed_checks; the exact check IDs go back to the builder);
 *   - a minor failure is advisory: reported and audited, never on its own a reason to rebuild;
 *   - a launch-stage check at preview, or a site-level check on a single file, is N/A with its reason.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Check, CheckResult, VerificationContext } from "./checks/types.js";
import { runOneCheck, type SiteLevelCheck } from "./runCheck.js";
import { secretsScanCheck } from "./checks/secretsScan.js";
import { responsiveCheck } from "./checks/responsive.js";
import { noConsoleErrorsCheck } from "./checks/noConsoleErrors.js";
import { imageOptimizationCheck } from "./checks/imageOptimization.js";
import { isolationCheck } from "./checks/isolation.js";
import { requiredSectionsCheck } from "./checks/requiredSections.js";
import { CLAIMS_CHECKS } from "./checks/claims.js";
import { STEP7_TEXT_CHECKS } from "./checks/registryChecks.js";

export type Severity = "blocker" | "major" | "minor";
export type Mode = "automated" | "model-judged";
export type Runner = "text" | "rendered" | "review" | "evaluator" | "attack";
export type Stage = "preview" | "launch";
export type Category =
  | "security" | "integrity" | "content-honesty" | "accessibility" | "performance" | "seo"
  | "responsive" | "console" | "links-assets" | "tells" | "design" | "judgment";

export type FixtureSpec =
  | string
  | { path: string; pages?: string[]; ctx?: Partial<Pick<VerificationContext, "clientSlug" | "requiredSections" | "otherClientSlugs" | "factSources">> }
  | { test: string; name: string };

export interface RegistryEntry {
  id: string;
  category: Category;
  severity: Severity;
  mode: Mode;
  runner: Runner;
  stage: Stage;
  proves: string;
  source: string;
  model: null | { slot: string; decision: string; why: string };
  fixtures: { pass: FixtureSpec; fail: FixtureSpec; isolated: boolean };
}

export interface EvaluationRegistry {
  version: string;
  fixtureContext: { brief: string; requiredSections: string[]; otherClientSlugs: string[] };
  checks: RegistryEntry[];
  tells: { declaredCount: number; named: { tell: string; checks: string[] }[]; missing: number; conflicts: string[]; source: string };
  sourceInventory: { available: string[]; missing: string[] };
  notCovered: string[];
}

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryError";
  }
}

export const REGISTRY_PATH = path.resolve(import.meta.dirname, "..", "config", "eval-registry.json");

/** Every deterministic text check implemented in code, by id. Each must have exactly one registry entry. */
export const TEXT_CHECK_IMPLS: ReadonlyMap<string, Check> = new Map(
  [secretsScanCheck, responsiveCheck, noConsoleErrorsCheck, imageOptimizationCheck, isolationCheck, requiredSectionsCheck, ...CLAIMS_CHECKS, ...STEP7_TEXT_CHECKS].map((c) => [c.id, c]),
);

const ENUMS = {
  category: ["security", "integrity", "content-honesty", "accessibility", "performance", "seo", "responsive", "console", "links-assets", "tells", "design", "judgment"],
  severity: ["blocker", "major", "minor"],
  mode: ["automated", "model-judged"],
  runner: ["text", "rendered", "review", "evaluator", "attack"],
  stage: ["preview", "launch"],
} as const;

const ID_RE = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;

function validFixture(spec: unknown): boolean {
  if (typeof spec === "string") return spec.length > 0;
  if (!spec || typeof spec !== "object") return false;
  const s = spec as Record<string, unknown>;
  if (typeof s.test === "string") return typeof s.name === "string" && s.name.length > 0;
  return typeof s.path === "string" && s.path.length > 0;
}

/** Validates the registry data against the code. Throws RegistryError naming the first problem. */
export function validateRegistry(reg: EvaluationRegistry): EvaluationRegistry {
  if (typeof reg.version !== "string" || !/^\d+\.\d+\.\d+$/.test(reg.version)) throw new RegistryError("registry needs a semver 'version'");
  if (!Array.isArray(reg.checks) || reg.checks.length === 0) throw new RegistryError("registry has no checks");
  const ids = new Set<string>();
  for (const e of reg.checks) {
    const where = `registry check ${JSON.stringify(e?.id)}`;
    if (typeof e.id !== "string" || !ID_RE.test(e.id)) throw new RegistryError(`${where}: id must be a lowercase dotted name`);
    if (ids.has(e.id)) throw new RegistryError(`${where}: listed twice`);
    ids.add(e.id);
    for (const [field, allowed] of Object.entries(ENUMS)) {
      if (!(allowed as readonly string[]).includes((e as unknown as Record<string, string>)[field]!)) throw new RegistryError(`${where}: ${field} must be one of ${allowed.join("/")}`);
    }
    if (typeof e.proves !== "string" || e.proves.trim().length < 10) throw new RegistryError(`${where}: 'proves' must say what the check proves`);
    if (typeof e.source !== "string" || e.source.trim() === "") throw new RegistryError(`${where}: 'source' is required (2.0 lineage or 'New in 3.0')`);
    if (!e.fixtures || !validFixture(e.fixtures.pass) || !validFixture(e.fixtures.fail) || typeof e.fixtures.isolated !== "boolean") {
      throw new RegistryError(`${where}: needs a passing fixture, a broken fixture and 'isolated'`);
    }
    if (e.mode === "model-judged") {
      if (!e.model || typeof e.model.slot !== "string" || typeof e.model.why !== "string") throw new RegistryError(`${where}: a model-judged check must name its model slot and why that model`);
      if (e.runner !== "review" && e.runner !== "evaluator") throw new RegistryError(`${where}: a model-judged check runs as review or evaluator`);
    } else {
      if (e.model !== null) throw new RegistryError(`${where}: an automated check uses no model (model: null)`);
      if (e.runner === "review" || e.runner === "evaluator") throw new RegistryError(`${where}: review/evaluator runners are model-judged`);
    }
    if (e.runner !== "text" && e.severity === "minor") throw new RegistryError(`${where}: only text checks may be minor (advisory); every other runner gates`);
    if (e.runner !== "text" && e.stage !== "preview") throw new RegistryError(`${where}: only text checks have a launch stage today`);
    if (e.runner === "text" && !TEXT_CHECK_IMPLS.has(e.id)) throw new RegistryError(`${where}: no text check with this id is implemented`);
  }
  for (const id of TEXT_CHECK_IMPLS.keys()) {
    if (!reg.checks.some((e) => e.id === id && e.runner === "text")) throw new RegistryError(`text check "${id}" is implemented but has no registry entry`);
  }
  for (const t of reg.tells?.named ?? []) for (const c of t.checks) if (!ids.has(c)) throw new RegistryError(`tell "${t.tell}" maps to unknown check "${c}"`);
  return reg;
}

export function loadRegistry(file: string = REGISTRY_PATH): EvaluationRegistry {
  return validateRegistry(JSON.parse(readFileSync(file, "utf-8")) as EvaluationRegistry);
}

let cached: EvaluationRegistry | null = null;
export function registry(): EvaluationRegistry {
  return (cached ??= loadRegistry());
}

export const entriesFor = (runner: Runner, reg: EvaluationRegistry = registry()) => reg.checks.filter((e) => e.runner === runner);
export const entryById = (id: string, reg: EvaluationRegistry = registry()) => reg.checks.find((e) => e.id === id);

/** Wraps a text check with its registry entry: stage gating, severity, advisory for minor. */
export function registryCheck(entry: RegistryEntry, impl: Check = TEXT_CHECK_IMPLS.get(entry.id)!): SiteLevelCheck {
  return {
    id: entry.id,
    description: impl.description,
    siteLevel: true,
    run(ctx: VerificationContext): CheckResult {
      if (entry.stage === "launch" && (ctx.stage ?? "preview") !== "launch") {
        return { checkId: entry.id, passed: true, details: [], severity: entry.severity, notApplicable: "launch-stage check (needs the production domain); runs with stage 'launch' before a human launch decision" };
      }
      const r = runOneCheck(ctx, impl);
      return { ...r, checkId: entry.id, severity: entry.severity, ...(!r.passed && entry.severity === "minor" ? { advisory: true } : {}) };
    },
  };
}

/** The deterministic text gate, in registry (fix) order. Every production entry point runs exactly this. */
export function gateTextChecks(reg: EvaluationRegistry = registry()): Check[] {
  return entriesFor("text", reg).map((e) => registryCheck(e));
}

/** True when a result fails the gate (advisory and N/A results never do). */
export const gates = (r: CheckResult): boolean => !r.passed && !r.advisory;

/**
 * Results for registry entries an entry point cannot run (e.g. `npm run verify` has no browser): NOT RUN with the
 * reason, so a run that skipped them is "not verified", never approved.
 */
export function notRunResults(runners: Runner[], reason: string, reg: EvaluationRegistry = registry()): CheckResult[] {
  return reg.checks
    .filter((e) => runners.includes(e.runner))
    .map((e) => ({ checkId: e.id, passed: false, notRun: true, severity: e.severity, details: [reason] }));
}

/** One line per registry entry for a report: status, severity, category, stage, mode. */
export function registryTable(results: CheckResult[], reg: EvaluationRegistry = registry()): string[] {
  const byId = new Map(results.map((r) => [r.checkId, r]));
  return reg.checks.map((e) => {
    const r = byId.get(e.id);
    const status = !r ? "NOT IN RUN" : r.notRun ? "NOT RUN" : r.notApplicable ? "N/A" : r.passed ? "PASS" : r.advisory ? "WARN" : "FAIL";
    return `${status.padEnd(10)} ${e.id.padEnd(30)} ${e.severity.padEnd(7)} ${e.category.padEnd(15)} ${e.runner.padEnd(9)} ${e.stage.padEnd(7)} ${e.mode}`;
  });
}
