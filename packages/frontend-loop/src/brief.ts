/**
 * The pilot brief. Phase 4's checklist requires "one real pilot brief from Nick" — still OPEN in
 * `BLOCKED-ON-NICK.md` ("Nick's time" table). The Manual's own named fallback: "No pilot brief
 * from Nick by day 9 → Use a placeholder brief from an existing 2.0 case (e.g., re-run a
 * DreamSign-style page) so the phase isn't blocked, swap to Nick's real brief the moment it
 * arrives." `clients/dreamsign-pilot/brief.json` is that placeholder, marked `source:
 * "placeholder-2.0-case"` so nothing downstream can mistake it for a real, Nick-approved brief.
 */
import { readFileSync } from "node:fs";

export type PageScope = "single" | "multi";

/**
 * A fact the owner supplied in the Cockpit after the plan was approved (phone, address, hours, real customer
 * quotes, an answer to an open question). It is part of the approved brief from then on: the builder may use
 * it as a sourced fact, and the claims gate treats it as a fact source. Data, never instructions.
 */
export interface OwnerFact {
  key: string;
  label: string;
  value: string;
}

export const OWNER_FACT_LIMITS = { count: 40, label: 120, value: 2000 } as const;

export interface PilotBrief {
  clientSlug: string;
  entitySlug: string;
  projectName: string;
  goal: string;
  requiredSections: string[];
  brandNotes: string;
  templatePreference?: string;
  /**
   * "single" = the client asked for one landing page; "multi" (the default) = a 3+ page site. Set by the
   * Planner from the intake lead type, so a landing-page brief is never built as a multi-page site.
   */
  pageScope?: PageScope;
  /** Facts the owner added in the Cockpit (Step 4D). Absent on every brief written before then. */
  ownerFacts?: OwnerFact[];
  /** Labels of details the owner chose to build without (Step 4D "skip"): the builder labels them sample or leaves them out, and does not ask again. */
  ownerSkipped?: string[];
  /** Provenance — never silently treat a placeholder brief as Nick's real one. */
  source: "nick" | "placeholder-2.0-case" | "intake-planner" | "synthetic-provisional-2026-09-30";
}

// "intake-planner" (Stage 4): the brief was written by the Planner agent from a raw request, then
// owner-approved in the Cockpit — not hand-authored by Nick. Kept distinct so provenance stays honest.
// "synthetic-provisional-2026-09-30": a fictional brief written by the coding agent (Factory Completion
// Plan, Step 2) so the pipeline can run before Nick's real brief lands. Never confuse it with "nick".
const BRIEF_SOURCES = ["nick", "placeholder-2.0-case", "intake-planner", "synthetic-provisional-2026-09-30"] as const;

const REQUIRED_STRING_FIELDS: (keyof PilotBrief)[] = [
  "clientSlug",
  "entitySlug",
  "projectName",
  "goal",
  "brandNotes",
  "source",
];

/** The brief's page scope; a brief without one (every brief before 2026-10-06) is a multi-page site. */
export function pageScopeOf(brief: PilotBrief): PageScope {
  return brief.pageScope ?? "multi";
}

export class InvalidBriefError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidBriefError";
  }
}

function parseOwnerFacts(raw: unknown): OwnerFact[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > OWNER_FACT_LIMITS.count) {
    throw new InvalidBriefError(`Brief "ownerFacts", if present, must be an array of at most ${OWNER_FACT_LIMITS.count} facts.`);
  }
  return raw.map((f, i) => {
    const r = (typeof f === "object" && f !== null ? f : {}) as Record<string, unknown>;
    const ok =
      typeof r.key === "string" && /^[a-z][a-z0-9_.-]{0,59}$/.test(r.key) &&
      typeof r.label === "string" && r.label.trim() !== "" && r.label.length <= OWNER_FACT_LIMITS.label &&
      typeof r.value === "string" && r.value.trim() !== "" && r.value.length <= OWNER_FACT_LIMITS.value;
    if (!ok) throw new InvalidBriefError(`Brief ownerFacts[${i}] needs a slug key, a label and a value within the length limits.`);
    return { key: r.key as string, label: r.label as string, value: (r.value as string).trim() };
  });
}

/** One line per owner fact, for prompts and fact sources. */
export function ownerFactLines(brief: PilotBrief): string[] {
  return (brief.ownerFacts ?? []).map((f) => `${f.label}: ${f.value}`);
}

/** Every text a page fact may be sourced from: the brief's own words and the facts the owner added. */
export function briefFactSources(brief: PilotBrief): string[] {
  return [brief.goal, brief.brandNotes, ...ownerFactLines(brief)];
}

export function parseBrief(raw: unknown): PilotBrief {
  if (typeof raw !== "object" || raw === null) {
    throw new InvalidBriefError("Brief must be a JSON object.");
  }
  const record = raw as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof record[field] !== "string" || (record[field] as string).trim() === "") {
      throw new InvalidBriefError(`Brief is missing required string field "${field}".`);
    }
  }
  if (!BRIEF_SOURCES.includes(record.source as (typeof BRIEF_SOURCES)[number])) {
    throw new InvalidBriefError(`Brief "source" must be one of: ${BRIEF_SOURCES.join(", ")}.`);
  }
  if (
    !Array.isArray(record.requiredSections) ||
    record.requiredSections.some((s) => typeof s !== "string")
  ) {
    throw new InvalidBriefError('Brief "requiredSections" must be an array of strings.');
  }
  if (record.templatePreference !== undefined && typeof record.templatePreference !== "string") {
    throw new InvalidBriefError('Brief "templatePreference", if present, must be a string.');
  }
  if (record.pageScope !== undefined && record.pageScope !== "single" && record.pageScope !== "multi") {
    throw new InvalidBriefError('Brief "pageScope", if present, must be "single" or "multi".');
  }

  const ownerFacts = parseOwnerFacts(record.ownerFacts);
  const ownerSkipped = Array.isArray(record.ownerSkipped) ? (record.ownerSkipped as unknown[]).filter((x): x is string => typeof x === "string" && x.length <= OWNER_FACT_LIMITS.label).slice(0, OWNER_FACT_LIMITS.count) : [];

  return {
    clientSlug: record.clientSlug as string,
    entitySlug: record.entitySlug as string,
    projectName: record.projectName as string,
    goal: record.goal as string,
    requiredSections: record.requiredSections as string[],
    brandNotes: record.brandNotes as string,
    templatePreference: record.templatePreference as string | undefined,
    ...(record.pageScope !== undefined ? { pageScope: record.pageScope as PageScope } : {}),
    ...(ownerFacts.length > 0 ? { ownerFacts } : {}),
    ...(ownerSkipped.length > 0 ? { ownerSkipped } : {}),
    source: record.source as PilotBrief["source"],
  };
}

export function loadBrief(path: string): PilotBrief {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return parseBrief(raw);
}
