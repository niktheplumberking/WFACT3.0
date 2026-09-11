/**
 * Responsive check — one of the Manual's 5 named Phase 5 example checks. Every page
 * `packages/frontend-loop` builds is prompted to be "mobile-first responsive" (see
 * `templates.ts`'s `styleGuidance`), but that's a builder-side instruction, not a verified
 * property — this checks the actual output, independently of whether the builder claims to have
 * followed it.
 */
import type { Check, CheckResult, VerificationContext } from "./types.js";

const VIEWPORT_META_PATTERN = /<meta[^>]+name=["']viewport["'][^>]*>/i;
const MEDIA_QUERY_PATTERN = /@media[^{]*\{/i;

export const responsiveCheck: Check = {
  id: "responsive-check",
  description: "Page must declare a viewport meta tag and include at least one @media rule.",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    if (!VIEWPORT_META_PATTERN.test(ctx.html)) {
      details.push('No <meta name="viewport" ...> tag found — page will not scale on mobile.');
    }
    if (!MEDIA_QUERY_PATTERN.test(ctx.html)) {
      details.push("No @media rule found in inline <style> — layout is not responsive.");
    }
    return { checkId: "responsive-check", passed: details.length === 0, details };
  },
};
