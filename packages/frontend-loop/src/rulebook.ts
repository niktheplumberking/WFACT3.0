/**
 * The design rulebook (design/rulebook.json) as builder prompt text (Step 4B). The builder cannot
 * load Claude skills at run time, so the anti-slop rules travel in its system prompt; the same rule
 * ids come back from rendered QA (render.design-rules / render.design-review) when a page breaks one.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export interface DesignRule {
  id: string;
  kind: "banned" | "required";
  title: string;
  rule: string;
  briefCanAllow: boolean;
}

export const DESIGN_RULEBOOK: { version: string; rules: DesignRule[] } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "..", "design", "rulebook.json"), "utf-8"),
);

export function rulebookPromptText(): string {
  const line = (r: DesignRule) => `- ${r.id}: ${r.rule}${r.briefCanAllow ? " (Allowed only if the brief explicitly asks for it.)" : ""}`;
  return [
    `DESIGN RULEBOOK v${DESIGN_RULEBOOK.version}. The page fails verification if it breaks any of these; failures come back to you by rule id.`,
    "Never do:",
    ...DESIGN_RULEBOOK.rules.filter((r) => r.kind === "banned").map(line),
    "Always do:",
    ...DESIGN_RULEBOOK.rules.filter((r) => r.kind === "required").map(line),
    "Facts: use only facts in the brief. Anything else (phone, hours, areas, ratings, testimonials) must be visibly labelled SAMPLE.",
    "Output ends at </html>; nothing may follow it.",
  ].join("\n");
}
