/**
 * Stage 5 glue: wrap any model client used in this repo so every call writes a model_traces row,
 * priced from the ONE price table (routing.ts `costForModel`). Lives in Hermes-lite because model
 * selection and pricing are Hermes' configuration (Blueprint §6); the tracing mechanism itself is
 * `traceModelCalls` in @wfact/audit.
 *
 * Recognised clients (by their existing `name` + counters — no client code changes needed):
 *   - "claude"          text clients in hermes / frontend-loop / verification   → complete(), totalUsage.{inputTokens,outputTokens}, modelIdUsed
 *   - "agent37"         frontend-loop's Agent 37 builder                        → complete(), totalUsage.{promptTokens,completionTokens}, model "hermes-agent"
 *   - "claude:<model>"  planning's structured-output client                     → completeJson(), totalUsage.{inputTokens,outputTokens}
 *   - "openai"          verification's second-vendor QA evaluator (Step 7)        → complete(), totalUsage.{inputTokens,outputTokens}, modelIdUsed
 * Anything else is refused loudly — an unknown client would otherwise go untraced.
 */
import { runContext, traceModelCalls, type TraceSink } from "@wfact/audit";
import { costForModel } from "./routing.js";

type AnyClient = { name: string; totalUsage?: Record<string, number>; modelIdUsed?: string };

export function traceModelClient<T extends object>(client: T, sink: TraceSink, fallbackActor: string): T {
  const c = client as unknown as AnyClient;
  const cost = (model: string, usage: { inputTokens: number; outputTokens: number }) => costForModel(model, usage);
  if (c.name === "claude" && c.modelIdUsed) {
    return traceModelCalls(client, {
      sink, method: "complete", provider: "anthropic", model: c.modelIdUsed, cost, fallbackActor,
      usage: () => ({ inputTokens: c.totalUsage!.inputTokens ?? 0, outputTokens: c.totalUsage!.outputTokens ?? 0 }),
    });
  }
  // Step 7: the second-vendor QA evaluator (packages/verification OpenAIModelClient).
  if (c.name === "openai" && c.modelIdUsed) {
    return traceModelCalls(client, {
      sink, method: "complete", provider: "openai", model: c.modelIdUsed, cost, fallbackActor,
      usage: () => ({ inputTokens: c.totalUsage!.inputTokens ?? 0, outputTokens: c.totalUsage!.outputTokens ?? 0 }),
    });
  }
  if (c.name === "agent37") {
    return traceModelCalls(client, {
      sink, method: "complete", provider: "agent37", model: "hermes-agent", cost, fallbackActor,
      usage: () => ({ inputTokens: c.totalUsage!.promptTokens ?? 0, outputTokens: c.totalUsage!.completionTokens ?? 0 }),
    });
  }
  if (c.name.startsWith("claude:")) {
    return traceModelCalls(client, {
      sink, method: "completeJson", provider: "anthropic", model: c.name.slice("claude:".length), cost, fallbackActor,
      usage: () => ({ inputTokens: c.totalUsage!.inputTokens ?? 0, outputTokens: c.totalUsage!.outputTokens ?? 0 }),
    });
  }
  throw new Error(`traceModelClient: don't know how to trace a "${c.name}" client — add it here rather than run it untraced`);
}

/**
 * MVP M6: the screenshot reviewer (packages/rendered-qa) calls its gateway directly, not through a model client,
 * so its calls were never traced. These hooks write one model_traces row per reviewer call (priced from the one
 * price table, tagged with the current runContext) and check the spend caps before each call.
 */
export function reviewerTraceHooks(
  sink: TraceSink,
  fallbackActor: string,
  capCheck?: () => Promise<void>,
): {
  beforeCall: () => Promise<void>;
  onCall: (call: { provider: "openai" | "agent37" | "anthropic"; model: string; inputTokens: number; outputTokens: number; ms: number; outcome: "success" | "error"; error: string | null }) => Promise<void>;
} {
  return {
    beforeCall: async () => {
      await capCheck?.();
    },
    onCall: async (call) => {
      const ctx = runContext.getStore();
      const price = costForModel(call.model, { inputTokens: call.inputTokens, outputTokens: call.outputTokens });
      await sink.writeTrace({
        runId: ctx?.runId ?? null,
        taskId: ctx?.taskId ?? null,
        actor: ctx?.actor ?? fallbackActor,
        provider: call.provider,
        model: call.model,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        costUsd: price.basis === "unpriced" ? null : price.costUsd,
        priceBasis: price.basis,
        pricingVersion: price.pricingVersion,
        latencyMs: call.ms,
        outcome: call.outcome,
        error: call.error ? call.error.slice(0, 500) : null,
        entitySlug: ctx?.entitySlug ?? null,
      });
    },
  };
}
