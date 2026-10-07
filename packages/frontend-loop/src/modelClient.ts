/**
 * Model adapter for Phase 4. Deliberately the same shape as `packages/hermes/src/modelClient.ts`
 * (interface, Claude implementation, mock, env loader) rather than a shared import — each phase's
 * package stays self-contained per this repo's existing convention, and there's no workspace/
 * monorepo tooling wired yet to share code safely across packages.
 *
 * 2026-09-22: Agent 37 (a self-hosted Nous Research "Hermes Agent" gateway, OpenAI-compatible —
 * see BLOCKED-ON-NICK.md) is now live and is the Fast-Track Plan's default free-tier router.
 * Routing decision (Huraira, 2026-09-22): the **builder** defaults to Agent 37 — bulk page
 * generation is exactly the "free tier by default" case the routing rule describes. The
 * **evaluator** keeps calling Claude directly, per the routing rule's own "when a step genuinely
 * needs it" clause: CLAUDE.md §6 says the evaluator should ideally be a different model/vendor
 * than the builder, which this repo has carried as a known, disclosed gap since Phase 4 started
 * (see README.md) — routing the evaluator to Agent 37 too would keep both roles on the same
 * underlying model family and leave that gap exactly where it was; routing it to Claude instead
 * closes it for real, for the one call where vendor independence actually matters. Kimi K3 stays
 * unwired (still unresolved in BLOCKED-ON-NICK.md) — this interface is shaped so that swap is
 * additive later (a `KimiModelClient implements ModelClient`).
 */
import Anthropic from "@anthropic-ai/sdk";

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

// See packages/hermes/src/modelClient.ts for why this is an env-overridable default, not a
// hardcoded literal buried in logic.
const DEFAULT_MODEL_ID = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 16000;

export class ClaudeModelClient implements ModelClient {
  readonly name = "claude";
  private readonly client: Anthropic;
  private readonly modelId: string;
  public readonly modelIdUsed: string;
  // Same rationale as packages/hermes/src/modelClient.ts's totalUsage: real per-call cost
  // logging per the Fast-Track routing rule, accumulated across every complete() this instance
  // makes (the loop can call the builder or evaluator many times across correction rounds).
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
      throw new Error(`Claude output truncated at max_tokens=${MAX_OUTPUT_TOKENS} (thinking included) — cannot build a page from a cut-off answer.`);
    }
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude response contained no text block — cannot build a page from this.");
    }
    return textBlock.text;
  }
}

/**
 * OpenAI-Chat-Completions-compatible client for the Agent 37 gateway. Verified live 2026-09-22
 * (see BLOCKED-ON-NICK.md): HTTP 200 does not guarantee a real completion — a broken upstream
 * provider on the gateway's own side previously returned HTTP 200 with an error message *as* the
 * message content (`hermes.failed: true`, `finish_reason: "error"`). complete() treats that the
 * same as a network failure — throws, never returns an error string dressed up as a real answer.
 */
/**
 * Transient gateway failures are retried after a wait, with a hard cap, then thrown (CLAUDE.md §6: bounded,
 * exponential backoff, then escalate). One dropped connection ("fetch failed" after 25 ms) ended a whole live
 * Track A build (Cockpit job ad49df57, 2026-10-07) because the builder client had no retry at all.
 * Transient = no response (network error), HTTP 5xx or 429. Anything else (4xx, an unusable answer) is not retried here.
 */
export const AGENT37_RETRY_DELAYS_MS = [5_000, 15_000, 45_000];
/** One call that takes longer than this is treated as no answer (and retried like one). Without it a hung gateway ran to the 30-minute job limit. */
export const AGENT37_REQUEST_TIMEOUT_MS = 6 * 60_000;

class TransientGatewayError extends Error {}

export class Agent37ModelClient implements ModelClient {
  readonly name = "agent37";
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly retryDelaysMs: number[];
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  public totalUsage = { promptTokens: 0, completionTokens: 0 };
  /** Transient failures retried so far by this instance (visible to tests and traces' callers). */
  public retries = 0;

  constructor(
    baseUrl: string,
    apiKey: string,
    opts: { retryDelaysMs?: number[]; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; timeoutMs?: number } = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? AGENT37_REQUEST_TIMEOUT_MS;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.retryDelaysMs = opts.retryDelaysMs ?? AGENT37_RETRY_DELAYS_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async complete(request: ModelRequest): Promise<string> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.completeOnce(request);
      } catch (err) {
        const delay = this.retryDelaysMs[attempt];
        if (!(err instanceof TransientGatewayError) || delay === undefined) {
          throw err instanceof TransientGatewayError
            ? new Error(`${err.message} (after ${attempt + 1} attempts; gateway unavailable, escalating)`)
            : err;
        }
        this.retries += 1;
        await this.sleep(delay);
      }
    }
  }

  private async completeOnce({ system, user }: ModelRequest): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model: "hermes-agent",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
    } catch (err) {
      throw new TransientGatewayError(`Agent 37 request failed: no response (${err instanceof Error ? err.message : String(err)})`);
    }
    if (!res.ok) {
      const msg = `Agent 37 request failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`;
      throw res.status >= 500 || res.status === 429 ? new TransientGatewayError(msg) : new Error(msg);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      hermes?: { failed?: boolean; error?: string };
    };
    if (data.hermes?.failed) {
      throw new Error(`Agent 37 reported failure: ${data.hermes.error ?? "unknown error"}`);
    }
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "error" || !choice?.message?.content) {
      throw new Error(
        `Agent 37 returned no usable completion (finish_reason: ${choice?.finish_reason ?? "none"})`,
      );
    }
    if (data.usage) {
      this.totalUsage.promptTokens += data.usage.prompt_tokens ?? 0;
      this.totalUsage.completionTokens += data.usage.completion_tokens ?? 0;
    }
    return choice.message.content;
  }
}

/**
 * Builds the builder and evaluator clients from env, applying the 2026-09-22 routing decision:
 * builder → Agent 37 by default (falls back to Claude if Agent 37 isn't configured), evaluator →
 * Claude directly (vendor independence from the builder, see this file's header comment). Returns
 * a reason string alongside whichever client was actually chosen, so the CLI can log why.
 */
export function modelClientFromEnv(
  role: "builder" | "evaluator",
  env: NodeJS.ProcessEnv = process.env,
): { client: ModelClient | null; reason: string | null; chose: string | null } {
  if (role === "builder" && env.AGENT37_BASE_URL && env.AGENT37_API_KEY) {
    return {
      client: new Agent37ModelClient(env.AGENT37_BASE_URL, env.AGENT37_API_KEY),
      reason: null,
      chose: "agent37 (default free-tier router per the Fast-Track Plan's routing rule)",
    };
  }

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      client: null,
      reason:
        "Neither AGENT37_BASE_URL/AGENT37_API_KEY nor ANTHROPIC_API_KEY is set. Per " +
        "BLOCKED-ON-NICK.md, Phase 4's loop cannot generate a real page without one.",
      chose: null,
    };
  }
  const why =
    role === "evaluator"
      ? "claude (vendor independence from the Agent 37 builder, per CLAUDE.md §6)"
      : "claude (Agent 37 not configured, falling back per the routing rule)";
  return { client: new ClaudeModelClient(apiKey, env.ANTHROPIC_MODEL), reason: null, chose: why };
}

/** Deterministic stand-in for tests — no network, no key, fully inspectable. */
export class MockModelClient implements ModelClient {
  readonly name = "mock";
  public readonly calls: ModelRequest[] = [];

  constructor(private readonly respond: (request: ModelRequest, callIndex: number) => string) {}

  async complete(request: ModelRequest): Promise<string> {
    const result = this.respond(request, this.calls.length);
    this.calls.push(request);
    return result;
  }
}
