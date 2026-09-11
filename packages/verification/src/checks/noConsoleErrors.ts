/**
 * "No console errors" — one of the Manual's 5 named Phase 5 example checks. Without a headless
 * browser (out of scope for this sprint's time box, per CLAUDE.md §5's template-first / minimal-
 * tooling spirit), the closest deterministic proxy for "won't throw in the console" is: every
 * inline <script> block must be syntactically valid JS (a parse-time syntax error always throws
 * immediately in a real browser), and there must be no external <script src="..."> reference,
 * since `templates.ts` requires every generated page to be fully self-contained — an external
 * script is either a 404 (console error) or an unreviewed dependency, either way a defect here.
 */
import vm from "node:vm";
import type { Check, CheckResult, VerificationContext } from "./types.js";

const SCRIPT_TAG_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const SRC_ATTR_PATTERN = /\bsrc\s*=/i;

export const noConsoleErrorsCheck: Check = {
  id: "no-console-errors",
  description:
    "Every inline <script> must parse as valid JS, and no <script src> (external, out of scope) may be present.",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    let match: RegExpExecArray | null;
    let scriptIndex = 0;
    SCRIPT_TAG_PATTERN.lastIndex = 0;
    while ((match = SCRIPT_TAG_PATTERN.exec(ctx.html)) !== null) {
      scriptIndex += 1;
      const [, attrs, body] = match;
      if (SRC_ATTR_PATTERN.test(attrs ?? "")) {
        details.push(
          `<script> #${scriptIndex} references an external src — page must be self-contained (no build step, no external assets).`,
        );
        continue;
      }
      const code = (body ?? "").trim();
      if (code.length === 0) continue;
      try {
        // Parse only — never execute untrusted generated JS. A SyntaxError here is exactly the
        // class of bug that throws immediately in a real browser console.
        new vm.Script(code);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        details.push(`<script> #${scriptIndex} has a syntax error and would throw in the console: ${message}`);
      }
    }
    return { checkId: "no-console-errors", passed: details.length === 0, details };
  },
};
