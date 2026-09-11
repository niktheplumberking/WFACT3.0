/**
 * Required-sections check — a deterministic backstop, not one of the Manual's 5 named examples
 * but within its "5–8 checks" range. Phase 4's evaluator (`packages/frontend-loop/src/loop.ts`)
 * already judges "are all required sections present" — but that judgment comes from the same
 * *kind* of model as the builder (Claude, per Phase 4's own named fallback). This check re-proves
 * the same property with zero model involvement at all, so a required section's presence is never
 * resting on an LLM's word alone.
 */
import type { Check, CheckResult, VerificationContext } from "./types.js";

/** Tags stripped, not just markup — an attribute value like src="hero.png" must never count as
 * the visible text "hero" being present. Without this, `<img src="hero.png">` alone would
 * satisfy a "hero" required section with no actual hero content on the page. */
function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

function sectionPresent(html: string, section: string): boolean {
  const idPattern = new RegExp(`id\\s*=\\s*["']${escapeRegExp(section)}["']`, "i");
  if (idPattern.test(html)) return true;
  // Fall back to a loose text match against headings/labels — section names are often rendered
  // as human-readable text ("Contact" for "contact") rather than only as an id attribute. Word
  // boundaries + tag-stripped text keep this from matching inside an unrelated word or an
  // attribute value.
  const words = section.replace(/[-_]/g, " ");
  const textPattern = new RegExp(`\\b${escapeRegExp(words)}\\b`, "i");
  return textPattern.test(visibleText(html));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const requiredSectionsCheck: Check = {
  id: "required-sections",
  description: "Every required section must appear by id or readable text, checked without a model.",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    for (const section of ctx.requiredSections) {
      if (!sectionPresent(ctx.html, section)) {
        details.push(`Required section "${section}" was not found (checked by id and by text).`);
      }
    }
    return { checkId: "required-sections", passed: details.length === 0, details };
  },
};
