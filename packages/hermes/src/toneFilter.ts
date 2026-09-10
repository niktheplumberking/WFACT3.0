/**
 * The plain-language tone filter. Built here, in Phase 3, not bolted on later — per the
 * Ecosystem Blueprint §Phase 3: "the tone-filtering layer identified as a gap on the team's own
 * call (Hermes answering too technically for a non-technical founder) gets built here."
 *
 * Two layers, both deliberately simple for a v1:
 *  1. A system-prompt instruction, prepended to every live model call.
 *  2. A deterministic post-pass that swaps known jargon for plain equivalents and flags whatever
 *     it couldn't rewrite, so the controller can decide whether to retry or just log a warning.
 * The post-pass is the part that's actually testable without a live model — that's on purpose.
 */

// term -> plain-language replacement. Keep additions here, not scattered through prompts.
export const JARGON_GLOSSARY: Record<string, string> = {
  RLS: "the data-isolation rules",
  "row-level security": "the data-isolation rules",
  schema: "data structure",
  migration: "database update",
  trigger: "automatic rule",
  endpoint: "connection point",
  "smoke test": "quick real-world check",
  repo: "project folder",
  deploy: "publish",
  deployment: "publishing",
  instance: "copy",
  "service role key": "the app's full-access database key",
  webhook: "automatic notification",
  API: "connection",
  SQL: "database query language",
};

// Sorted longest-first so multi-word phrases match before their shorter substrings do.
const GLOSSARY_ENTRIES = Object.entries(JARGON_GLOSSARY).sort((a, b) => b[0].length - a[0].length);

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ToneFilterResult {
  text: string;
  /** Jargon terms that were found and replaced. */
  replacedTerms: string[];
  /** Acronym-shaped tokens (e.g. "MCP", "CI") left in the output after replacement, for review. */
  remainingAcronyms: string[];
}

export function applyToneFilter(rawText: string): ToneFilterResult {
  let text = rawText;
  const replacedTerms: string[] = [];

  for (const [term, plain] of GLOSSARY_ENTRIES) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
    if (pattern.test(text)) {
      replacedTerms.push(term);
      text = text.replace(pattern, plain);
    }
  }

  // Anything left that looks like a 2-5 letter all-caps acronym is worth a human's eyes, even
  // if it isn't in the glossary yet — better to flag an unknown term than silently ship it.
  const acronymMatches = text.match(/\b[A-Z]{2,5}\b/g) ?? [];
  const remainingAcronyms = [...new Set(acronymMatches)];

  return { text, replacedTerms, remainingAcronyms };
}

export function buildPlainLanguageSystemPrompt(): string {
  return [
    "You are answering a status question for a non-technical founder, not a fellow engineer.",
    "Use plain English. No acronyms without expanding them on first use. No implementation detail",
    "(database internals, code structure, tool names) unless the founder explicitly asked for it.",
    "State what stage things are at, what's blocking, and what happens next. If you don't know,",
    "say so plainly instead of guessing — never invent a status.",
  ].join(" ");
}
