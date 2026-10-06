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
import { recordAudit, type AuditContext } from "@wfact/audit";

const AUDIT_INPUT_CAP = 2000;

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "undefined";
  } catch {
    return String(value);
  }
}

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

export interface ToolRegistryOptions {
  /**
   * When set, every invoke() — including refused and failed ones — writes one `tool.invoke` row to
   * `audit_log` (Continuation Plan Stage 1). Fails closed: if the audit write throws, the call
   * throws too, so no tool result is ever handed back without its audit row.
   */
  audit?: AuditContext;
  /**
   * Step 6: asked before every allowlisted tool runs (after the allowlist lookup, before input validation). The
   * composition root passes the controller's PermissionGate (`gate.authorize({ kind: "tool", name })` from
   * @wfact/agent-runtime, which writes `agent.deny` on refusal). Injected rather than imported because
   * agent-runtime already depends on this package. A throw is recorded as a refused (`rejected`) tool.invoke.
   */
  authorize?: (toolName: string) => Promise<void>;
}

export class ToolNotPermittedError extends Error {
  constructor(public readonly toolName: string, public readonly denial: unknown) {
    super(`Tool "${toolName}" is allowlisted but not permitted for this caller: ${denial instanceof Error ? denial.message : String(denial)}`);
    this.name = "ToolNotPermittedError";
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>>();
  private readonly audit: AuditContext | null;
  private readonly authorize: ((toolName: string) => Promise<void>) | null;

  constructor(opts: ToolRegistryOptions = {}) {
    this.audit = opts.audit ?? null;
    this.authorize = opts.authorize ?? null;
  }

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
    const startedAt = Date.now();
    let output: unknown;
    try {
      output = await this.invokeUnaudited(toolName, rawInput);
    } catch (err) {
      // Refusals (not allowlisted, bad input) are "rejected" — the boundary did its job. Anything
      // else (handler threw, output broke contract) is a "failure". Both get a row, then rethrow.
      const outcome =
        err instanceof ToolNotAllowlistedError || err instanceof ToolNotPermittedError || err instanceof ToolInputValidationError
          ? "rejected"
          : "failure";
      await this.recordInvoke(toolName, rawInput, outcome, startedAt, err);
      throw err;
    }
    await this.recordInvoke(toolName, rawInput, "success", startedAt, null, output);
    return output;
  }

  private async invokeUnaudited(toolName: string, rawInput: unknown): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotAllowlistedError(toolName);
    }

    if (this.authorize) {
      try {
        await this.authorize(toolName);
      } catch (err) {
        // An audit-write failure inside the gate is not a refusal: fail closed and let it surface as itself.
        if (err instanceof Error && err.name === "AuditWriteError") throw err;
        throw new ToolNotPermittedError(toolName, err);
      }
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

  private async recordInvoke(
    toolName: string,
    rawInput: unknown,
    outcome: "success" | "failure" | "rejected",
    startedAt: number,
    err: unknown,
    output?: unknown,
  ): Promise<void> {
    if (!this.audit) return;
    // Input is logged (capped): it may be model-supplied, which is exactly what an audit needs to
    // show. Output is logged by size only — memory files and state rows don't belong in the trail.
    const inputJson = safeJson(rawInput);
    await recordAudit(this.audit, {
      action: "tool.invoke",
      outcome,
      payload: {
        tool: toolName,
        input: inputJson.length > AUDIT_INPUT_CAP ? `${inputJson.slice(0, AUDIT_INPUT_CAP)}…(truncated)` : rawInput,
        durationMs: Date.now() - startedAt,
        ...(output !== undefined ? { outputBytes: safeJson(output).length } : {}),
        ...(err ? { error: err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 500) : String(err) } : {}),
      },
    });
  }
}
