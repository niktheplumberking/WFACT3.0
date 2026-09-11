/**
 * The pilot brief. Phase 4's checklist requires "one real pilot brief from Nick" — still OPEN in
 * `BLOCKED-ON-NICK.md` ("Nick's time" table). The Manual's own named fallback: "No pilot brief
 * from Nick by day 9 → Use a placeholder brief from an existing 2.0 case (e.g., re-run a
 * DreamSign-style page) so the phase isn't blocked, swap to Nick's real brief the moment it
 * arrives." `clients/dreamsign-pilot/brief.json` is that placeholder, marked `source:
 * "placeholder-2.0-case"` so nothing downstream can mistake it for a real, Nick-approved brief.
 */
import { readFileSync } from "node:fs";

export interface PilotBrief {
  clientSlug: string;
  entitySlug: string;
  projectName: string;
  goal: string;
  requiredSections: string[];
  brandNotes: string;
  templatePreference?: string;
  /** Provenance — never silently treat a placeholder brief as Nick's real one. */
  source: "nick" | "placeholder-2.0-case";
}

const REQUIRED_STRING_FIELDS: (keyof PilotBrief)[] = [
  "clientSlug",
  "entitySlug",
  "projectName",
  "goal",
  "brandNotes",
  "source",
];

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
  if (record.source !== "nick" && record.source !== "placeholder-2.0-case") {
    throw new InvalidBriefError('Brief "source" must be "nick" or "placeholder-2.0-case".');
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

  return {
    clientSlug: record.clientSlug as string,
    entitySlug: record.entitySlug as string,
    projectName: record.projectName as string,
    goal: record.goal as string,
    requiredSections: record.requiredSections as string[],
    brandNotes: record.brandNotes as string,
    templatePreference: record.templatePreference as string | undefined,
    source: record.source as "nick" | "placeholder-2.0-case",
  };
}

export function loadBrief(path: string): PilotBrief {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return parseBrief(raw);
}
