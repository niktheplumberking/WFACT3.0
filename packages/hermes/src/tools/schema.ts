/**
 * Schema-validated tool wrapper + allowlist.
 *
 * Direct implementation of CLAUDE.md §6: "Every tool call goes through a schema-validated
 * wrapper with an allowlist — never a raw shell command built from model output." This is the
 * fix for the 2026 Gemini CLI supply-chain incident: nothing in this file lets a model's own
 * output become an executable path, command, or query. A tool can only be invoked by its
 * registered name, with input validated against its zod schema *before* the handler ever runs,
 * and output validated *after* — so a handler bug can't silently hand the caller a malformed
 * result either.
 */
import { z } from "zod";

export class ToolNotAllowlistedError extends Error {
  constructor(public readonly toolName: string) {
    super(
      `Tool "${toolName}" is not in the allowlist. Hermes-lite never calls a tool that ` +
        `hasn't been explicitly registered — see packages/hermes/src/tools/registry.ts.`,
    );
    this.name = "ToolNotAllowlistedError";
  }
}

export class ToolInputValidationError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(`Input for tool "${toolName}" failed schema validation: ${JSON.stringify(issues)}`);
    this.name = "ToolInputValidationError";
  }
}

export class ToolOutputValidationError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(
      `Output of tool "${toolName}" failed schema validation — the handler returned something ` +
        `its own contract doesn't allow: ${JSON.stringify(issues)}`,
    );
    this.name = "ToolOutputValidationError";
  }
}

export interface ToolDefinition<InputSchema extends z.ZodTypeAny, OutputSchema extends z.ZodTypeAny> {
  /** Stable, human-readable name. This is the only string a caller may use to invoke the tool. */
  name: string;
  /** One line: what this tool does and why it's safe to allowlist (read-only, scoped, etc). */
  description: string;
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
  handler: (input: z.infer<InputSchema>) => Promise<z.infer<OutputSchema>>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>>();

  /** Register a tool. Call sites are the only allowlist — there is no dynamic registration path. */
  register<InputSchema extends z.ZodTypeAny, OutputSchema extends z.ZodTypeAny>(
    tool: ToolDefinition<InputSchema, OutputSchema>,
  ): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered — refusing a silent overwrite.`);
    }
    this.tools.set(tool.name, tool as unknown as ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>);
  }

  listAllowlisted(): { name: string; description: string }[] {
    return [...this.tools.values()].map(({ name, description }) => ({ name, description }));
  }

  async invoke(toolName: string, rawInput: unknown): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotAllowlistedError(toolName);
    }

    const parsedInput = tool.inputSchema.safeParse(rawInput);
    if (!parsedInput.success) {
      throw new ToolInputValidationError(toolName, parsedInput.error.issues);
    }

    const result = await tool.handler(parsedInput.data);

    const parsedOutput = tool.outputSchema.safeParse(result);
    if (!parsedOutput.success) {
      throw new ToolOutputValidationError(toolName, parsedOutput.error.issues);
    }

    return parsedOutput.data;
  }
}
