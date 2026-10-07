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
import { digestEpisodes, type Episode } from "./tools/episodes.js";

// Placeholder entities per memory/context.md §2 and BLOCKED-ON-NICK.md — swap for the real,
// confirmed list once Nick closes that decision. Aliases exist because a founder will type
// "Bennett" or "Bennett & Co", not the slug "bennett-co".
export const KNOWN_ENTITIES: { slug: string; aliases: string[] }[] = [
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

/**
 * Step 5: which client folder a question is about. "What happened on Summit Line Roofing's build?" names the
 * `summit-line-roofing` client: the slug's words must appear in the question as whole words. Longest match wins
 * (so a client named "summit-line" never shadows "summit-line-roofing"). The question is data used only to pick
 * which allowlisted read to make; it never becomes a path (the slug comes from the known list).
 */
export function detectClientSlug(question: string, clientSlugs: readonly string[]): string | null {
  const normalized = ` ${question.toLowerCase().replace(/['’]s\b/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
  let best: string | null = null;
  for (const slug of clientSlugs) {
    if (!/^[a-z][a-z0-9-]*$/.test(slug)) continue;
    if (normalized.includes(` ${slug.replace(/-/g, " ")} `) && (!best || slug.length > best.length)) best = slug;
  }
  return best;
}

/** "What happened", "how did the build go", "history": answered from the episodic entries, not hand-written prose. */
export function isHistoryQuestion(question: string): boolean {
  return /\b(happen(ed|ing)?|history|so far|went|go(ne)?|build|built|run|runs|timeline|progress)\b/i.test(question);
}

export interface HermesAnswer {
  question: string;
  entitySlug: string | null;
  /** Step 5: the client folder the question named, when it named one. */
  clientSlug?: string | null;
  /** Step 5: how many episodic entries the answer was given (0 when none were used). */
  episodesUsed?: number;
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
  /** Step 5: known client folder names (memoryTools.listClientSlugs), so a question can name a client. */
  clientSlugs?: string[];
}

export class HermesLite {
  private readonly toolRegistry: ToolRegistry;
  private readonly modelClient: ModelClient;
  private readonly retry: { maxAttempts: number; baseDelayMs: number };
  private readonly clientSlugs: string[];

  constructor(opts: HermesLiteOptions) {
    this.toolRegistry = opts.toolRegistry;
    this.modelClient = opts.modelClient;
    this.retry = opts.retry ?? { maxAttempts: 3, baseDelayMs: 500 };
    this.clientSlugs = opts.clientSlugs ?? [];
  }

  async answerStatusQuestion(question: string, explicitEntitySlug?: string): Promise<HermesAnswer> {
    let entitySlug = explicitEntitySlug ?? detectEntitySlug(question);
    const clientSlug = detectClientSlug(question, this.clientSlugs);
    const sourcesUsed: string[] = [];
    const contextParts: string[] = [];
    let episodesUsed = 0;

    // 1. Business-wide memory — always pulled, it's small and it's the law file's own §8 order.
    const context = (await this.toolRegistry.invoke("memory.readContext", {})) as {
      content: string;
      path: string;
    };
    sourcesUsed.push(context.path);
    contextParts.push(`--- ${context.path} ---\n${context.content}`);

    if (clientSlug) {
      // 2a. Step 5: the question named a client folder. Its memory comes through the same allowlisted tool; for a
      // "what happened" question the answer is built from the Documentation agent's structured entries only, so it
      // rests on the audited record rather than on hand-written notes.
      const mem = (await this.toolRegistry.invoke("memory.readClient", { clientSlug })) as {
        found: boolean;
        content: string | null;
        path: string;
        episodes: Episode[];
        episodeProblems: { line: number; entryId: string | null; problem: string }[];
      };
      const episodes = (mem.episodes ?? []).filter((e) => e.clientSlug === clientSlug);
      if (!entitySlug && episodes[0]) entitySlug = episodes[0].entitySlug;
      if (mem.found && episodes.length > 0 && isHistoryQuestion(question)) {
        episodesUsed = episodes.length;
        sourcesUsed.push(`${mem.path}#episodic-log (${episodes.length} entries)`);
        contextParts.push(
          `--- ${mem.path}, episodic log: structured entries written by the Documentation agent from the audit trail ` +
            `(not by a human), oldest first ---\n${digestEpisodes(episodes)}` +
            (mem.episodeProblems.length
              ? `\n(${mem.episodeProblems.length} entr${mem.episodeProblems.length === 1 ? "y was" : "ies were"} left out because ${mem.episodeProblems.length === 1 ? "it" : "they"} failed validation or had been edited by hand; say so.)`
              : ""),
        );
      } else if (mem.found && mem.content) {
        sourcesUsed.push(mem.path);
        contextParts.push(`--- ${mem.path} ---\n${mem.content}`);
      } else {
        contextParts.push(`--- clients/${clientSlug}/memory.md ---\n(no client memory file yet)`);
      }
    }

    if (entitySlug && !clientSlug) {
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
    }

    // A history answer built from episodes needs no live project rows (they may be fixture data, see below).
    if (entitySlug && episodesUsed === 0) {
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
        clientSlug,
        episodesUsed,
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
        clientSlug,
        episodesUsed,
        sourcesUsed,
        answer: "",
        toneFilter: { text: "", replacedTerms: [], remainingAcronyms: [] },
        needsHuman: true,
        escalationReason: reason,
      };
    }
  }
}
