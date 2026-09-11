/**
 * Model adapter for Phase 4. Deliberately the same shape as `packages/hermes/src/modelClient.ts`
 * (interface, Claude implementation, mock, env loader) rather than a shared import — each phase's
 * package stays self-contained per this repo's existing convention (Phase 3 did the same thing),
 * and there's no workspace/monorepo tooling wired yet to share code safely across packages.
 *
 * Phase 4's own checklist calls for "Configure the front-end agent (Kimi K3 as candidate
 * executor)." Per the Operator's Manual's own named fallback for this phase: "Kimi K3 API access
 * is delayed → Use Claude for front-end generation this sprint, swap Kimi K3 in once access
 * lands." `KIMI_API_KEY` is listed in `.env.example` for Phase 4 but is not wired here — there is
 * nothing to swap into yet, and BLOCKED-ON-NICK.md still lists it as unresolved. This interface is
 * shaped so that swap is additive later (a `KimiModelClient implements ModelClient`), same pattern
 * `ModelClient` already proved out in Phase 3 for the Claude/GPT-5.6/Kimi routing question.
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

  constructor(apiKey: string, modelId: string = DEFAULT_MODEL_ID) {
    this.client = new Anthropic({ apiKey });
    this.modelId = modelId;
  }

  async complete({ system, user }: ModelRequest): Promise<string> {
    const response = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude response contained no text block — cannot build a page from this.");
    }
    return textBlock.text;
  }
}

/**
 * Builds a fresh `ClaudeModelClient` from env, or returns null with a clear reason. Called once
 * per role (builder, evaluator) by `cli.ts` — two separate calls yield two separate `Anthropic`
 * client instances, which is what satisfies CLAUDE.md §6's "the evaluator is never the same
 * instance ... as the builder" at the construction site, not just by convention.
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
        "(\"Claude / Anthropic API billing confirmation\") — the same blocker that stopped " +
        "Phase 3's live smoke test also stops Phase 4's loop from generating a real page.",
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
