/**
 * "No console errors" — one of the Manual's 5 named Phase 5 example checks. Without a headless
 * browser (out of scope for this sprint's time box, per CLAUDE.md §5's template-first / minimal-
 * tooling spirit), the closest deterministic proxy for "won't throw in the console" is: every
 * inline <script> block must be syntactically valid JS (a parse-time syntax error always throws
 * immediately in a real browser), and there must be no external <script src="..."> reference,
 * since `templates.ts` requires every generated page to be fully self-contained — an external
 * script is either a 404 (console error) or an unreviewed dependency, either way a defect here.
 *
 * Step 4B M4: on a page of a multi-page site, a <script src> that points at a file the site itself
 * contains (a Next.js export's /_next/static chunks) is not external: it is allowed, and that file is
 * parsed for syntax errors exactly like an inline script. Anything with a scheme, protocol-relative, or
 * missing from the site is still a defect.
 */
import path from "node:path";
import vm from "node:vm";
import type { Check, CheckResult, SiteFiles, VerificationContext } from "./types.js";

/** Parse results per site file, so a chunk shared by every page is parsed once per site. */
const parsed = new WeakMap<SiteFiles, Map<string, string | null>>();

function siteScriptProblem(site: SiteFiles, page: string, src: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(src)) return "references an external src — page must be self-contained (no external assets).";
  const clean = src.split(/[?#]/)[0]!;
  const name = clean.startsWith("/") ? clean.slice(1) : path.posix.join(path.posix.dirname(page), clean);
  const code = site.files[name];
  if (code === undefined || (site.binary ?? []).includes(name)) return `references ${src}, which is not a script file of this site (it would 404).`;
  let cache = parsed.get(site);
  if (!cache) parsed.set(site, (cache = new Map()));
  if (!cache.has(name)) {
    try {
      new vm.Script(code, { filename: name });
      cache.set(name, null);
    } catch (err) {
      cache.set(name, `loads ${src}, which has a syntax error and would throw in the console: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return cache.get(name)!;
}

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
        const src = (attrs ?? "").match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? "";
        if (ctx.pageOf) {
          const problem = siteScriptProblem(ctx.pageOf.site, ctx.pageOf.page, src);
          if (problem) details.push(`<script> #${scriptIndex} ${problem}`);
          continue;
        }
        details.push(
          `<script> #${scriptIndex} references an external src — page must be self-contained (no build step, no external assets).`,
        );
        continue;
      }
      const code = (body ?? "").trim();
      if (code.length === 0) continue;
      // Step 4B M3: structured data (<script type="application/ld+json">) is JSON, not script; the
      // browser never executes it, but invalid JSON-LD is still a defect.
      const type = (attrs ?? "").match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
      if (type && !/^(text|application)\/(javascript|ecmascript)$|^module$/.test(type)) {
        if (/json/.test(type)) {
          try {
            JSON.parse(code);
          } catch (err) {
            details.push(`<script type="${type}"> #${scriptIndex} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        continue;
      }
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
