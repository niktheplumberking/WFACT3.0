/**
 * Hermes-lite: the Phase 3 stand-in controller. See README.md for why this exists instead of the
 * self-hosted Hermes Agent, and CLAUDE.md §6 for the scope this stays inside:
 *
 *   Hermes should control: task decomposition & routing, context assembly, tool permission
 *   gating, escalation.
 *   Hermes should never: execute code, edit files, call production APIs directly, hold final
 *   approval on money/launch, be the only source of truth for state, grade its own routing.
 *
 * This controller only ever reads (via the allowlisted ToolRegistry) and calls one model. It has
 * no write tool available to it at all — not gated off, simply not registered anywhere.
 */
import type { ToolRegistry } from "./tools/schema.js";
import type { ModelClient } from "./modelClient.js";
import { applyToneFilter, buildPlainLanguageSystemPrompt, type ToneFilterResult } from "./toneFilter.js";
import { withBoundedRetry, EscalationError } from "./escalation.js";

// Placeholder entities per memory/context.md §2 and BLOCKED-ON-NICK.md — swap for the real,
// confirmed list once Nick closes that decision. Aliases exist because a founder will type
// "Bennett" or "Bennett & Co", not the slug "bennett-co".
const KNOWN_ENTITIES: { slug: string; aliases: string[] }[] = [
  { slug: "dreamsign", aliases: ["dreamsign"] },
  { slug: "bennett-co", aliases: ["bennett", "bennett & co", "bennett and co", "bennett-co"] },
];

export function detectEntitySlug(question: string): string | null {
  const normalized = question.toLowerCase();
  for (const entity of KNOWN_ENTITIES) {
    if (entity.aliases.some((alias) => normalized.includes(alias))) {
      return entity.slug;
    }
  }
  return null;
}

export interface HermesAnswer {
  question: string;
  entitySlug: string | null;
  sourcesUsed: string[];
  answer: string;
  toneFilter: ToneFilterResult;
  needsHuman: boolean;
  escalationReason: string | null;
}

export interface HermesLiteOptions {
  toolRegistry: ToolRegistry;
  modelClient: ModelClient;
  retry?: { maxAttempts: number; baseDelayMs: number };
}

export class HermesLite {
  private readonly toolRegistry: ToolRegistry;
  private readonly modelClient: ModelClient;
  private readonly retry: { maxAttempts: number; baseDelayMs: number };

  constructor(opts: HermesLiteOptions) {
    this.toolRegistry = opts.toolRegistry;
    this.modelClient = opts.modelClient;
    this.retry = opts.retry ?? { maxAttempts: 3, baseDelayMs: 500 };
  }

  async answerStatusQuestion(question: string, explicitEntitySlug?: string): Promise<HermesAnswer> {
    const entitySlug = explicitEntitySlug ?? detectEntitySlug(question);
    const sourcesUsed: string[] = [];
    const contextParts: string[] = [];

    // 1. Business-wide memory — always pulled, it's small and it's the law file's own §8 order.
    const context = (await this.toolRegistry.invoke("memory.readContext", {})) as {
      content: string;
      path: string;
    };
    sourcesUsed.push(context.path);
    contextParts.push(`--- ${context.path} ---\n${context.content}`);

    if (entitySlug) {
      // 2. Per-client memory, if a client folder exists for this entity yet.
      const clientMemory = (await this.toolRegistry.invoke("memory.readClient", {
        clientSlug: entitySlug,
      })) as { found: boolean; content: string | null; path: string };
      if (clientMemory.found && clientMemory.content) {
        sourcesUsed.push(clientMemory.path);
        contextParts.push(`--- ${clientMemory.path} ---\n${clientMemory.content}`);
      } else {
        contextParts.push(`--- clients/${entitySlug}/memory.md ---\n(no client memory file yet)`);
      }

      // 3. Live state, only if the state tool is actually registered (i.e. Supabase is configured).
      if (this.toolRegistry.listAllowlisted().some((t) => t.name === "state.projectStatus")) {
        const state = (await this.toolRegistry.invoke("state.projectStatus", {
          entitySlug,
        })) as { entitySlug: string; projects: unknown[] };
        sourcesUsed.push(`supabase:projects(entity=${entitySlug})`);
        contextParts.push(
          `--- live state, entity "${entitySlug}" (source: Supabase state layer; may be test ` +
            `fixture data, not a real client, until real client rows land) ---\n` +
            JSON.stringify(state.projects, null, 2),
        );
      } else {
        contextParts.push("--- live state ---\n(state layer not configured, see .env.example)");
      }
    }

    const userPrompt = [
      `Founder's question: "${question}"`,
      "",
      "Everything below is source material read from memory and state. Answer only from this —",
      "if it doesn't say, say you don't know rather than guessing.",
      "",
      contextParts.join("\n\n"),
    ].join("\n");

    try {
      const rawAnswer = await withBoundedRetry(
        () => this.modelClient.complete({ system: buildPlainLanguageSystemPrompt(), user: userPrompt }),
        this.retry,
      );
      const toneFilter = applyToneFilter(rawAnswer);
      return {
        question,
        entitySlug,
        sourcesUsed,
        answer: toneFilter.text,
        toneFilter,
        needsHuman: false,
        escalationReason: null,
      };
    } catch (err) {
      // Per CLAUDE.md §6: hard cap, then escalate — never silently retry forever, and never
      // return a fabricated answer dressed up as a real one.
      const reason = err instanceof EscalationError ? err.reason : String(err);
      return {
        question,
        entitySlug,
        sourcesUsed,
        answer: "",
        toneFilter: { text: "", replacedTerms: [], remainingAcronyms: [] },
        needsHuman: true,
        escalationReason: reason,
      };
    }
  }
}
