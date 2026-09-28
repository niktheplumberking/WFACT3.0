/**
 * Structured-output model client for Intake and Planner. Blueprint §3: "every agent-to-agent handoff
 * is a validated schema, never freeform prose parsed with regex." Two layers, on purpose:
 *   1. the API is constrained to the JSON schema (`output_config.format`, Claude structured outputs);
 *   2. the caller re-validates with zod anyway — the constraint is the model's contract, the zod
 *      parse is ours, and a handoff is only trusted after OUR check (CLAUDE.md §1).
 *
 * The model id is never chosen here: it comes from a Hermes-lite route (packages/hermes/src/routing.ts).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ModelRoute } from "@wfact/hermes-lite/routing";

export interface JsonRequest {
  system: string;
  user: string;
  /** JSON Schema the response must satisfy. */
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface JsonModelClient {
  readonly name: string;
  readonly route: ModelRoute | null;
  readonly totalUsage: { inputTokens: number; outputTokens: number };
  completeJson(request: JsonRequest): Promise<unknown>;
}

export class ModelOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelOutputError";
  }
}

export class ClaudeJsonClient implements JsonModelClient {
  readonly name: string;
  readonly totalUsage = { inputTokens: 0, outputTokens: 0 };
  private readonly client: Anthropic;

  constructor(
    readonly route: ModelRoute,
    apiKey: string,
  ) {
    this.client = new Anthropic({ apiKey });
    this.name = `claude:${route.model}`;
  }

  async completeJson({ system, user, schema, maxTokens }: JsonRequest): Promise<unknown> {
    const response = await this.client.messages.create({
      model: this.route.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema } },
    });
    this.totalUsage.inputTokens += response.usage.input_tokens;
    this.totalUsage.outputTokens += response.usage.output_tokens;
    if (response.stop_reason === "refusal") throw new ModelOutputError("model refused the request");
    if (response.stop_reason === "max_tokens") throw new ModelOutputError(`output truncated at max_tokens=${maxTokens}`);
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new ModelOutputError("response had no text block");
    try {
      return JSON.parse(text.text);
    } catch {
      throw new ModelOutputError(`response was not valid JSON: ${text.text.slice(0, 200)}`);
    }
  }
}

/** Deterministic stand-in for tests: scripted outputs, every request recorded. */
export class MockJsonClient implements JsonModelClient {
  readonly name = "mock";
  readonly route = null;
  readonly totalUsage = { inputTokens: 0, outputTokens: 0 };
  readonly calls: JsonRequest[] = [];

  constructor(private readonly respond: (req: JsonRequest, index: number) => unknown) {}

  async completeJson(request: JsonRequest): Promise<unknown> {
    const out = this.respond(request, this.calls.length);
    this.calls.push(request);
    if (out instanceof Error) throw out;
    return structuredClone(out);
  }
}

/** A zod-4 JSON Schema, minus the `$schema` marker the API doesn't need. */
export function toApiSchema(jsonSchema: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = jsonSchema;
  return rest;
}
