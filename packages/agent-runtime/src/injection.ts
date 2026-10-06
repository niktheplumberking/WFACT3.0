/**
 * Prompt-injection screen for ingested client text (Step 6 task 5; Blueprint §12: "input validation and semantic
 * filtering on any retrieved or ingested content ... and the standing rule that file content is data, never
 * instructions"; §16I).
 *
 * What this is: a small, versioned list of patterns for text that addresses the system instead of describing a
 * website ("ignore previous instructions", "email the API key", "write to another client's folder"). `runAgent`
 * runs it over the task input of every role whose scope sets `scanInputForInjection`, and writes one
 * `agent.injection_suspected` audit row per run that matches.
 *
 * What it is NOT: the defence. The defence is structural and does not depend on spotting the attack:
 *   - the text is fenced as data in every prompt and the model's output is schema-constrained;
 *   - nothing a model returns can name a tool, a path or a table: agents only perform fixed I/O, and every one
 *     of those goes through the PermissionGate, which denies anything outside the role's scope or binding.
 * So a match does not stop the run (a client may legitimately write "ignore the old logo"); it leaves a trail for
 * the owner, and the gate is what refuses the action if a model was actually steered.
 */

export const INJECTION_PATTERNS_VERSION = "1";

export interface InjectionPattern {
  id: string;
  description: string;
  re: RegExp;
}

export const INJECTION_PATTERNS: readonly InjectionPattern[] = [
  {
    id: "override-instructions",
    description: "asks the model to ignore, forget or override its instructions",
    re: /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your|the|system)\b[^.\n]{0,30}\b(instructions?|prompts?|rules?|directions?|guidelines?|messages?)\b/i,
  },
  {
    id: "role-reassignment",
    description: "tries to re-assign the model's role or open a new system prompt",
    re: /\b(you are now|from now on,? you|act as (an?|the) (admin|administrator|developer|root|system)|new system prompt|system prompt:|<\s*\/?\s*system\s*>)/i,
  },
  {
    id: "secret-exfiltration",
    description: "asks for keys, tokens, passwords or environment variables to be revealed or sent",
    re: /\b(send|email|e-mail|mail|post|upload|reveal|print|show|share|leak|forward|give)\b[^.\n]{0,60}\b(api[ _-]?keys?|secret(s| keys?)?|tokens?|passwords?|credentials?|env(ironment)? var(iable)?s?|\.env|service[ _-]?role)\b/i,
  },
  {
    id: "cross-client-access",
    description: "asks to read or write another client's or entity's files or records",
    re: /\b(write|save|put|copy|move|read|open|delete|overwrite|modify|access)\b[^.\n]{0,60}\b(another|other|different|every|all)\b[^.\n]{0,20}\b(clients?|customers?|entit(y|ies)|tenants?)\b[^.\n]{0,20}\b(folders?|director(y|ies)|files?|records?|rows?|data)\b/i,
  },
  {
    id: "path-traversal",
    description: "contains a parent-directory path or a path into clients/ or memory/",
    re: /(\.\.\/|\.\.\\|\bclients\/[a-z0-9_-]+\/|\bmemory\/[a-z0-9_-]+\.md)/i,
  },
  {
    id: "tool-or-command",
    description: "asks the model to run a command, call a tool or execute code",
    re: /\b(run|execute|exec|call|invoke)\b[^.\n]{0,30}\b(shell|bash|command|script|tool|function|curl|wget|rm -rf|sudo)\b/i,
  },
];

export interface InjectionFinding {
  patternId: string;
  /** Where in the input (dotted path to the string leaf). */
  field: string;
  /** A short window around the match, capped, for the audit row. */
  excerpt: string;
}

const MAX_LEAVES = 2000;
const EXCERPT_RADIUS = 60;

function* stringLeaves(value: unknown, at: string, depth = 0): Generator<[string, string]> {
  if (depth > 8) return;
  if (typeof value === "string") {
    yield [at || "(input)", value];
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) yield* stringLeaves(value[i], `${at}[${i}]`, depth + 1);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) yield* stringLeaves(v, at ? `${at}.${k}` : k, depth + 1);
  }
}

/** Every pattern hit in the string leaves of `input` (at most one finding per pattern per field). */
export function scanForInjection(input: unknown): InjectionFinding[] {
  const findings: InjectionFinding[] = [];
  let n = 0;
  for (const [field, text] of stringLeaves(input, "")) {
    if (++n > MAX_LEAVES) break;
    for (const p of INJECTION_PATTERNS) {
      const m = p.re.exec(text);
      if (!m) continue;
      const start = Math.max(0, m.index - EXCERPT_RADIUS);
      const end = Math.min(text.length, m.index + m[0].length + EXCERPT_RADIUS);
      findings.push({ patternId: p.id, field, excerpt: text.slice(start, end).replace(/\s+/g, " ").slice(0, 200) });
    }
  }
  return findings;
}
