/**
 * Same shape as `packages/hermes/src/modelClient.ts` and `packages/frontend-loop/src/modelClient.ts`
 * — self-contained per this repo's existing convention (no shared workspace tooling wired yet, see
 * those files' own comments for why). This is Phase 5's evaluator model: the Manual's own fallback
 * for "no time for a truly separate model as evaluator" is "a separate Claude session as a
 * stand-in, flagged clearly as temporary" — a fresh `Anthropic` client instance here, distinct from
 * whatever instance built or Phase-4-reviewed the page.
 *
 * 2026-09-22: kept on Claude deliberately, not switched to Agent 37. Phase 4's builder now
 * defaults to Agent 37 (see packages/frontend-loop/src/modelClient.ts) — routing this evaluator
 * to Agent 37 too would mean the same model family checking its own output at one remove, exactly
 * the correlated-failure risk CLAUDE.md §6 exists to prevent. Since the builder changed vendor,
 * this file's own "ideally different vendor" gap (previously Claude reviewing Claude) is now
 * genuinely closed, not just structurally distinct instances.
 */
import Anthropic from "@anthropic-ai/sdk";
import { familyOf, loadEvaluatorConfig, type EvaluatorConfig, type ModelIdentity } from "./crossModel.js";

export interface ModelRequest {
  system: string;
  user: string;
}

export interface ModelClient {
  readonly name: string;
  complete(request: ModelRequest): Promise<string>;
}

export class ModelNotConfiguredError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ModelNotConfiguredError";
  }
}

const DEFAULT_MODEL_ID = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 16000;

export class ClaudeModelClient implements ModelClient {
  readonly name = "claude";
  private readonly client: Anthropic;
  private readonly modelId: string;
  public readonly modelIdUsed: string;
  // Same rationale as the other two packages' modelClient.ts — real cost logging per the
  // Fast-Track routing rule.
  public totalUsage = { inputTokens: 0, outputTokens: 0 };

  constructor(apiKey: string, modelId: string = DEFAULT_MODEL_ID) {
    this.client = new Anthropic({ apiKey });
    this.modelId = modelId;
    this.modelIdUsed = modelId;
  }

  async complete({ system, user }: ModelRequest): Promise<string> {
    const response = await this.client.messages.create({
      model: this.modelId,
      // claude-sonnet-5 thinks adaptively by default and thinking counts against max_tokens: at 4096 a
      // multi-page review spent the whole budget thinking and returned no text (Step 4B M3 live run
      // b2cd975e). 16000 is the recommended non-streaming ceiling; it is a cap, not a cost.
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
    });
    this.totalUsage.inputTokens += response.usage.input_tokens;
    this.totalUsage.outputTokens += response.usage.output_tokens;
    if (response.stop_reason === "max_tokens") {
      throw new Error(`Claude output truncated at max_tokens=${MAX_OUTPUT_TOKENS} (thinking included) — cannot verify a page from a cut-off answer.`);
    }
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude response contained no text block — cannot verify a page from this.");
    }
    return textBlock.text;
  }
}

/**
 * Step 7: the second-vendor evaluator. OpenAI Chat Completions over fetch (no SDK dependency), same contract
 * as ClaudeModelClient: token usage is accumulated for cost, a truncated or empty answer throws (a verdict is
 * never parsed from a cut-off reply), an HTTP error throws with the status (the key is never echoed).
 */
export class OpenAIModelClient implements ModelClient {
  readonly name = "openai";
  public readonly modelIdUsed: string;
  public totalUsage = { inputTokens: 0, outputTokens: 0 };

  constructor(
    private readonly apiKey: string,
    modelId: string = "gpt-5.4",
    private readonly baseUrl: string = "https://api.openai.com/v1",
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs: number = 180_000,
  ) {
    this.modelIdUsed = modelId;
  }

  async complete({ system, user }: ModelRequest): Promise<string> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelIdUsed,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const body = (await res.text()).replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-…").slice(0, 300);
      throw new Error(`OpenAI evaluator request failed: HTTP ${res.status} ${body}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (data.usage) {
      this.totalUsage.inputTokens += data.usage.prompt_tokens ?? 0;
      this.totalUsage.outputTokens += data.usage.completion_tokens ?? 0;
    }
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new Error(`OpenAI output truncated at max_completion_tokens=${MAX_OUTPUT_TOKENS} — cannot verify a page from a cut-off answer.`);
    }
    const text = choice?.message?.content;
    if (!text) throw new Error(`OpenAI response contained no text (finish_reason: ${choice?.finish_reason ?? "none"}) — cannot verify a page from this.`);
    return text;
  }
}

/**
 * Builds a fresh evaluator client from env, or returns null with a clear reason — same pattern as
 * `packages/frontend-loop/src/modelClient.ts#modelClientFromEnv`. Always a new instance, never the builder's.
 *
 * Step 7: the candidates and their order come from config/evaluator.json. With `avoid` (the builder's identity)
 * a candidate in the builder's model family is skipped, so a Claude builder (Agent 37 not configured) gets the
 * second vendor instead of a same-family evaluator. Without `avoid` the first candidate with a key wins
 * (Claude, as before Step 7). Composition roots still call assertCrossModelSeparation on the result.
 */
export function evaluatorModelClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  opts: { avoid?: ModelIdentity; config?: EvaluatorConfig; fetchImpl?: typeof fetch } = {},
): {
  client: ModelClient | null;
  reason: string | null;
} {
  const config = opts.config ?? loadEvaluatorConfig();
  const avoidFamily = opts.avoid ? familyOf(opts.avoid, config) : null;
  const skipped: string[] = [];
  for (const c of config.candidates) {
    const model = (c.modelEnv && env[c.modelEnv]) || c.model;
    const family = familyOf({ vendor: c.provider, model }, config);
    if (avoidFamily && family === avoidFamily) {
      skipped.push(`${c.provider}:${model} (same family as the builder, ${family})`);
      continue;
    }
    const key = env[c.keyEnv];
    if (!key) {
      skipped.push(`${c.provider}:${model} (${c.keyEnv} is not set)`);
      continue;
    }
    if (c.provider === "anthropic") return { client: new ClaudeModelClient(key, model), reason: null };
    return { client: new OpenAIModelClient(key, model, undefined, opts.fetchImpl), reason: null };
  }
  return {
    client: null,
    reason:
      `no evaluator model available (config/evaluator.json v${config.version}): ${skipped.join("; ")}. ` +
      "The deterministic checks still run and still mean something; only the evaluator step is blocked, so the run cannot be approved.",
  };
}

/** Deterministic stand-in for tests — no network, no key, fully inspectable. */
export class MockModelClient implements ModelClient {
  readonly name = "mock";
  public readonly calls: ModelRequest[] = [];

  /** `family` (optional, Step 7): lets a test give two mocks distinct model families for the cross-model rule. */
  constructor(
    private readonly respond: (request: ModelRequest, callIndex: number) => string,
    public readonly family?: string,
  ) {}

  async complete(request: ModelRequest): Promise<string> {
    const result = this.respond(request, this.calls.length);
    this.calls.push(request);
    return result;
  }
}
