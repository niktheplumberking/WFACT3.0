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

  return {
    clientSlug: record.clientSlug as string,
    entitySlug: record.entitySlug as string,
    projectName: record.projectName as string,
    goal: record.goal as string,
    requiredSections: record.requiredSections as string[],
    brandNotes: record.brandNotes as string,
    templatePreference: record.templatePreference as string | undefined,
    ...(record.pageScope !== undefined ? { pageScope: record.pageScope as PageScope } : {}),
    source: record.source as PilotBrief["source"],
  };
}

export function loadBrief(path: string): PilotBrief {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return parseBrief(raw);
}
