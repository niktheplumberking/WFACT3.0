/**
 * Model adapter interface. Phase 3 wires exactly one model (Claude) behind it, on purpose — per
 * the Ecosystem Blueprint's Phase 3 scope: "Do not build yet: multiple specialist agents in
 * parallel; prove the controller with one model path first." Model *routing* (choosing between
 * Claude/GPT-5.6/Kimi K3 per task type) is explicitly Phase 4 (Section 7's routing table), not
 * this file's job — this interface just makes that swap possible later without touching the
 * controller.
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

// A conservative default — override with ANTHROPIC_MODEL once a specific ID is confirmed.
// CLAUDE.md: "Re-verify anything time-sensitive (model IDs, pricing, credentials) before relying
// on it" — this string is exactly that kind of thing, so it's one env var, not a hardcoded literal
// buried in logic.
const DEFAULT_MODEL_ID = "claude-sonnet-5";

export class ClaudeModelClient implements ModelClient {
  readonly name = "claude";
  private readonly client: Anthropic;
  private readonly modelId: string;

  constructor(apiKey: string, modelId: string = DEFAULT_MODEL_ID) {
    this.client = new Anthropic({ apiKey });
    this.modelId = modelId;
  }

  async complete({ system, user }: ModelRequest): Promise<string> {
    const response = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude response contained no text block — cannot answer from this.");
    }
    return textBlock.text;
  }
}

/**
 * Build a ClaudeModelClient from env, or return null with a clear reason. Never returns a client
 * that will silently fail on first use — the "smoke test" law lives here: if this can't be built
 * for real, the caller must know that up front, not discover it mid-answer.
 */
export function modelClientFromEnv(env: NodeJS.ProcessEnv = process.env): {
  client: ModelClient | null;
  reason: string | null;
} {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      client: null,
      reason:
        "ANTHROPIC_API_KEY is not set. Per BLOCKED-ON-NICK.md this is an open, blocking item " +
        "(\"Claude / Anthropic API billing confirmation\") — Hermes-lite will not fabricate an " +
        "answer without a real model behind it.",
    };
  }
  return { client: new ClaudeModelClient(apiKey, env.ANTHROPIC_MODEL), reason: null };
}

/** Deterministic stand-in for tests — no network, no key, fully inspectable. */
export class MockModelClient implements ModelClient {
  readonly name = "mock";
  public readonly calls: ModelRequest[] = [];

  constructor(private readonly respond: (request: ModelRequest) => string) {}

  async complete(request: ModelRequest): Promise<string> {
    this.calls.push(request);
    return this.respond(request);
  }
}
