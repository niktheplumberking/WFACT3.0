/**
 * The evaluator step. Operator's Manual, Phase 5 checklist: "Wire an independent evaluator step,
 * a different model than the builder" with the named fallback "Use a strict written rubric plus a
 * separate Claude session as a stand-in." `RUBRIC` below is that strict written rubric — one line
 * per deterministic check already run (so the model is never asked to re-litigate what a script
 * already proved) plus the judgment calls a script genuinely can't make (visual coherence, whether
 * copy actually reads as finished). Same VERDICT/ISSUES protocol as
 * `packages/frontend-loop/src/loop.ts#parseReviewResponse` — deliberately strict, not free-form
 * JSON, same reasoning as that file's own comment on the point.
 */
import type { ModelClient } from "./modelClient.js";
import type { VerificationContext } from "./checks/types.js";

export interface EvaluatorVerdict {
  verdict: "approved" | "changes_requested";
  issues: string[];
}

export const RUBRIC = [
  "You are an independent verification reviewer in WFACT 3.0's Phase 5 loop, evaluating a page",
  "you did not build and that has already passed 6 automated checks (secrets scan, responsive",
  "check, no-console-errors, image optimization, isolation check, required-sections check).",
  "Do not re-check those — trust that they passed. Judge only what a script cannot:",
  "1. Does the copy read as finished, coherent prose (not placeholder or repeated text)?",
  "2. Is the visual structure implied by the HTML/CSS plausible (no obviously broken layout,",
  "   no illegible color combinations described in the inline styles)?",
  "3. Does the page actually deliver on the stated goal, not just contain the required sections?",
  "Respond in exactly this format, nothing else:",
  "VERDICT: APPROVED",
  "or",
  "VERDICT: CHANGES_REQUESTED",
  "ISSUES:",
  "- <issue 1>",
].join("\n");

export async function runEvaluator(
  model: ModelClient,
  ctx: VerificationContext,
  goal: string,
): Promise<EvaluatorVerdict> {
  const user = [
    `Page goal: ${goal}`,
    `Required sections (already verified present): ${ctx.requiredSections.join(", ")}`,
    "",
    "--- HTML to review ---",
    ctx.html,
  ].join("\n");
  const raw = await model.complete({ system: RUBRIC, user });
  return parseEvaluatorResponse(raw);
}

/** Same strict-protocol parsing as frontend-loop's `parseReviewResponse` — never silently approve. */
export function parseEvaluatorResponse(raw: string): EvaluatorVerdict {
  const trimmed = raw.trim();
  if (/^VERDICT:\s*APPROVED\b/i.test(trimmed)) {
    return { verdict: "approved", issues: [] };
  }

  const verdictMatch = /^VERDICT:\s*CHANGES_REQUESTED\b/i.test(trimmed);
  if (!verdictMatch) {
    return {
      verdict: "changes_requested",
      issues: [`Evaluator response did not follow the VERDICT protocol: "${trimmed.slice(0, 200)}"`],
    };
  }

  const issuesBlockMatch = trimmed.match(/ISSUES:\s*([\s\S]*)$/i);
  const issues = issuesBlockMatch
    ? issuesBlockMatch[1]!
        .split("\n")
        .map((line) => line.replace(/^[-*]\s*/, "").trim())
        .filter((line) => line.length > 0)
    : [];

  return {
    verdict: "changes_requested",
    issues: issues.length > 0 ? issues : ["Evaluator requested changes but listed no specific issues."],
  };
}
