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
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
    this.totalUsage.inputTokens += response.usage.input_tokens;
    this.totalUsage.outputTokens += response.usage.output_tokens;
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude response contained no text block — cannot verify a page from this.");
    }
    return textBlock.text;
  }
}

/**
 * Builds a fresh `ClaudeModelClient` from env, or returns null with a clear reason — same pattern
 * as `packages/frontend-loop/src/modelClient.ts#modelClientFromEnv`. Called separately from
 * whatever instance Phase 4 used, so this is always a distinct object even when both ultimately
 * wrap the same Claude account (the "ideally different vendor" half stays an open, tracked gap
 * until Kimi K3/GPT-5.6 access lands — see BLOCKED-ON-NICK.md).
 */
export function evaluatorModelClientFromEnv(env: NodeJS.ProcessEnv = process.env): {
  client: ModelClient | null;
  reason: string | null;
} {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      client: null,
      reason:
        "ANTHROPIC_API_KEY is not set. Per BLOCKED-ON-NICK.md this is the same open, blocking item " +
        "that stops Phase 3's and Phase 4's live runs — the deterministic checks in this package " +
        "still run and are still meaningful without it; only the evaluator step is blocked.",
    };
  }
  return { client: new ClaudeModelClient(apiKey, env.ANTHROPIC_MODEL), reason: null };
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
