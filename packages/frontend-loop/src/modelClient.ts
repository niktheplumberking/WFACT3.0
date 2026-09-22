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
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
    this.totalUsage.inputTokens += response.usage.input_tokens;
    this.totalUsage.outputTokens += response.usage.output_tokens;
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
export class Agent37ModelClient implements ModelClient {
  readonly name = "agent37";
  private readonly baseUrl: string;
  private readonly apiKey: string;
  public totalUsage = { promptTokens: 0, completionTokens: 0 };

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  async complete({ system, user }: ModelRequest): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "hermes-agent",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Agent 37 request failed: HTTP ${res.status} ${await res.text()}`);
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
