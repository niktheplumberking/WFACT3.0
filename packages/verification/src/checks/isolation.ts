/**
 * Isolation check — one of the Manual's 5 named Phase 5 example checks. CLAUDE.md §5's "Entity
 * law" ("one client per entity ... cross-client isolation ... attack-tested") was proven at the
 * database layer in Phase 2 (`packages/db/RLS_ATTACK_TEST_RESULTS.md`). This is the same law
 * applied to generated *content*: a page built for one client must never mention another known
 * client by slug — the kind of leak a template-driven builder could produce by echoing a stray
 * example, a leftover placeholder, or cross-contaminated context.
 */
import type { Check, CheckResult, VerificationContext } from "./types.js";

export const isolationCheck: Check = {
  id: "isolation-check",
  description: "Generated page must not mention any other known client's slug.",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    const haystack = ctx.html.toLowerCase();
    for (const other of ctx.otherClientSlugs) {
      if (other === ctx.clientSlug) continue; // never flag a client against itself
      const needle = other.toLowerCase().replace(/-/g, " ");
      const slugNeedle = other.toLowerCase();
      if (haystack.includes(slugNeedle) || haystack.includes(needle)) {
        details.push(`Page for "${ctx.clientSlug}" mentions another client's slug: "${other}".`);
      }
    }
    return { checkId: "isolation-check", passed: details.length === 0, details };
  },
};
