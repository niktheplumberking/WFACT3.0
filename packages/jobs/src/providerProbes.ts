/**
 * Readiness probes for the model providers a build will pay (2026-10-14), run by the workflow before any paid step.
 * Without them a build found out about exhausted credits or an unreachable gateway 5-28 minutes in (Cockpit jobs
 * 31c965ff and 456368c5: HTTP 402 "AI credits exhausted"; 6dec53e7, 5c85914b, b880a7d5: reviewer gateway down).
 *
 * Each probe is the cheapest call that shows the provider will answer:
 *   - Anthropic (reviewer and evaluator): a 1-token message on the reviewer's own model. It is the only call that
 *     shows "credit balance is too low" (a key check alone does not). Cost: a few input tokens, well under $0.001;
 *     not traced as a model generation.
 *   - Agent 37 (builder): GET /models. Free; shows reachability and a refused key or plan (401/402/403). A real
 *     completion would bill ~21k hidden tokens (docs/AI-COST-AUDIT.md 1b), so it is not used as a probe.
 * A busy provider (429, 5xx, 529) passes: the model clients already retry those, and a busy minute is not a reason to
 * stop. Only "will certainly fail" stops the run: no answer, a refused key, no credits.
 */
import type { PreflightCheck } from "@wfact/workflow";

const PROBE_TIMEOUT_MS = 15_000;

export interface ProbeConfig {
  anthropicKey?: string;
  /** The model the reviewer and evaluator use (rendered-qa/config/reviewer.json). */
  anthropicModel: string;
  agent37BaseUrl?: string;
  agent37Key?: string;
  fetchImpl?: typeof fetch;
}

const credits = (text: string) => /credit balance|credits? (exhausted|remaining)|insufficient (credit|funds|quota)|billing/i.test(text);

async function anthropic(cfg: ProbeConfig, f: typeof fetch): Promise<PreflightCheck> {
  const id = "provider.anthropic";
  if (!cfg.anthropicKey) return { id, ok: false, detail: "ANTHROPIC_API_KEY is not set, so the reviewer and evaluator cannot run" };
  let res: Response;
  try {
    res = await f("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": cfg.anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: cfg.anthropicModel, max_tokens: 1, messages: [{ role: "user", content: "ok" }] }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch (err) {
    return { id, ok: false, detail: `no answer (${err instanceof Error ? err.message : String(err)})` };
  }
  if (res.ok) return { id, ok: true, detail: "answers" };
  const text = (await res.text().catch(() => "")).slice(0, 300);
  if (res.status === 429 || res.status >= 500) return { id, ok: true, detail: `busy (HTTP ${res.status}); the calls themselves retry` };
  if (credits(text) || res.status === 402) return { id, ok: false, detail: `HTTP ${res.status}: credits exhausted (${text})` };
  if (res.status === 401 || res.status === 403) return { id, ok: false, detail: `HTTP ${res.status}: the API key was refused` };
  if (res.status === 404) return { id, ok: false, detail: `HTTP 404: the model "${cfg.anthropicModel}" is not available on this key` };
  return { id, ok: false, detail: `HTTP ${res.status}: ${text}` };
}

async function agent37(cfg: ProbeConfig, f: typeof fetch): Promise<PreflightCheck | null> {
  if (!cfg.agent37BaseUrl || !cfg.agent37Key) return null; // not the builder on this runner (Claude builds instead)
  const id = "provider.agent37";
  let res: Response;
  try {
    res = await f(`${cfg.agent37BaseUrl.replace(/\/+$/, "")}/models`, {
      headers: { Authorization: `Bearer ${cfg.agent37Key}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch (err) {
    return { id, ok: false, detail: `the builder gateway did not answer (${err instanceof Error ? err.message : String(err)})` };
  }
  const text = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 300);
  if (res.status === 402 || credits(text)) return { id, ok: false, detail: `HTTP ${res.status}: credits exhausted (${text})` };
  if (res.status === 401 || res.status === 403) return { id, ok: false, detail: `HTTP ${res.status}: the builder gateway refused the key` };
  // 2xx, or a gateway without a models list (404/405), or busy: it answered, which is what this probe can show for free.
  return { id, ok: true, detail: res.ok ? "answers" : `answers (HTTP ${res.status})` };
}

export function providerProbes(cfg: ProbeConfig): () => Promise<PreflightCheck[]> {
  const f = cfg.fetchImpl ?? fetch;
  return async () => {
    const [a, b] = await Promise.all([anthropic(cfg, f), agent37(cfg, f)]);
    return [a, ...(b ? [b] : [])];
  };
}
