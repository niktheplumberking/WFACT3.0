/**
 * Secrets scan — one of the Manual's 5 named Phase 5 example checks. Distinct from CI's
 * repo-wide `gitleaks` job (`.github/workflows/ci.yml`, which scans tracked source files): this
 * checks *generated page output* specifically, since a builder model could plausibly echo a key
 * it saw in a prompt, an env var, or a hallucinated-but-real-shaped credential straight into HTML.
 * "Never trust done, only verified" (CLAUDE.md §1) applies to build output, not just source.
 */
import type { Check, CheckResult, VerificationContext } from "./types.js";

interface SecretPattern {
  label: string;
  pattern: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { label: "Anthropic API key", pattern: /sk-ant-[a-zA-Z0-9_-]{10,}/ },
  { label: "generic OpenAI-shaped key", pattern: /sk-[a-zA-Z0-9]{20,}/ },
  { label: "AWS access key ID", pattern: /AKIA[0-9A-Z]{16}/ },
  { label: "Supabase/JWT-shaped bearer token", pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/ },
  { label: "PEM private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    label: "hardcoded secret/password/token assignment",
    pattern: /\b(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i,
  },
];

export const secretsScanCheck: Check = {
  id: "secrets-scan",
  description: "Generated HTML must not contain anything shaped like a real credential.",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    for (const { label, pattern } of SECRET_PATTERNS) {
      const match = ctx.html.match(pattern);
      if (match) {
        details.push(`Found what looks like a ${label}: "${match[0].slice(0, 40)}..."`);
      }
    }
    return { checkId: "secrets-scan", passed: details.length === 0, details };
  },
};
