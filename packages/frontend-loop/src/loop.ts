/**
 * The Phase 4 loop itself: generate → self-review → fix → done. Per the Operator's Manual's Phase
 * 4 exit check: "One real page live, plus an honest correction-round count logged and compared
 * against DreamSign's 40+."
 *
 * CLAUDE.md §6: "The evaluator is never the same instance, and ideally not the same model/vendor,
 * as the builder." With only Claude available this sprint (Kimi K3/GPT-5.6 both blocked per
 * `BLOCKED-ON-NICK.md`), this constructor enforces the "never the same instance" half structurally
 * — passing the same object reference for both roles throws immediately — and documents the
 * "ideally different vendor" half as a known, tracked gap (see README.md), matching the same
 * honest framing Phase 5's plan already uses for its own evaluator ("a separate Claude session as
 * a stand-in, flagged clearly as temporary until Kimi K3 or GPT-5.6 access allows a real
 * cross-model check").
 */
import type { ModelClient } from "./modelClient.js";
import type { PageTemplate } from "./templates.js";
import type { PilotBrief } from "./brief.js";

export interface CorrectionRound {
  round: number;
  verdict: "approved" | "changes_requested";
  issues: string[];
  timestamp: string;
}

export interface FrontendLoopResult {
  brief: PilotBrief;
  template: PageTemplate;
  finalHtml: string | null;
  rounds: CorrectionRound[];
  approved: boolean;
  needsHuman: boolean;
  escalationReason: string | null;
}

export interface FrontendLoopOptions {
  builderModel: ModelClient;
  evaluatorModel: ModelClient;
  /** Hard cap on correction rounds. CLAUDE.md §6: bounded, then escalate — never forever. */
  maxRounds?: number;
  nowIso?: () => string;
}

interface ReviewResult {
  verdict: "approved" | "changes_requested";
  issues: string[];
}

const DEFAULT_MAX_ROUNDS = 8;

export class FrontendLoop {
  private readonly builderModel: ModelClient;
  private readonly evaluatorModel: ModelClient;
  private readonly maxRounds: number;
  private readonly nowIso: () => string;

  constructor(opts: FrontendLoopOptions) {
    if (opts.builderModel === opts.evaluatorModel) {
      throw new Error(
        "builder and evaluator must be distinct ModelClient instances — CLAUDE.md §6: " +
          '"the evaluator is never the same instance ... as the builder."',
      );
    }
    this.builderModel = opts.builderModel;
    this.evaluatorModel = opts.evaluatorModel;
    this.maxRounds = opts.maxRounds ?? DEFAULT_MAX_ROUNDS;
    this.nowIso = opts.nowIso ?? (() => new Date().toISOString());
  }

  async run(brief: PilotBrief, template: PageTemplate): Promise<FrontendLoopResult> {
    let html = await this.generate(brief, template);
    const rounds: CorrectionRound[] = [];

    for (let round = 1; round <= this.maxRounds; round += 1) {
      const review = await this.review(brief, template, html);
      rounds.push({
        round,
        verdict: review.verdict,
        issues: review.issues,
        timestamp: this.nowIso(),
      });

      if (review.verdict === "approved") {
        return {
          brief,
          template,
          finalHtml: html,
          rounds,
          approved: true,
          needsHuman: false,
          escalationReason: null,
        };
      }

      html = await this.fix(brief, template, html, review.issues);
    }

    return {
      brief,
      template,
      finalHtml: html,
      rounds,
      approved: false,
      needsHuman: true,
      escalationReason:
        `Hit the ${this.maxRounds}-round cap without evaluator approval — escalating per ` +
        "CLAUDE.md §6 rather than retrying silently forever.",
    };
  }

  private buildSystemPrompt(): string {
    return [
      "You are the front-end builder in WFACT 3.0's Phase 4 loop.",
      "Produce a single, complete HTML5 document: semantic markup, inline <style>, no external",
      "assets, no build step, mobile-first responsive. Output only the HTML, no commentary before",
      "or after it, no markdown code fences.",
    ].join(" ");
  }

  private async generate(brief: PilotBrief, template: PageTemplate): Promise<string> {
    const user = [
      `Project: ${brief.projectName} (client: ${brief.clientSlug}, entity: ${brief.entitySlug})`,
      `Goal: ${brief.goal}`,
      `Brand notes: ${brief.brandNotes}`,
      `Template: ${template.name} — ${template.description}`,
      `Style guidance: ${template.styleGuidance}`,
      `Required sections (must all be present, identifiable by id or heading): ${[
        ...new Set([...template.requiredSections, ...brief.requiredSections]),
      ].join(", ")}`,
    ].join("\n");
    return this.builderModel.complete({ system: this.buildSystemPrompt(), user });
  }

  private buildEvaluatorSystemPrompt(): string {
    return [
      "You are an independent reviewer in WFACT 3.0's Phase 4 loop, evaluating a page you did not",
      "write. Judge only against the brief and required sections given to you — do not invent new",
      "requirements. Respond in exactly this format, nothing else:",
      "VERDICT: APPROVED",
      "or",
      "VERDICT: CHANGES_REQUESTED",
      "ISSUES:",
      "- <issue 1>",
      "- <issue 2>",
    ].join("\n");
  }

  private async review(
    brief: PilotBrief,
    template: PageTemplate,
    html: string,
  ): Promise<ReviewResult> {
    const requiredSections = [...new Set([...template.requiredSections, ...brief.requiredSections])];
    const user = [
      `Brief goal: ${brief.goal}`,
      `Brand notes: ${brief.brandNotes}`,
      `Required sections: ${requiredSections.join(", ")}`,
      "",
      "--- HTML to review ---",
      html,
    ].join("\n");
    const raw = await this.evaluatorModel.complete({
      system: this.buildEvaluatorSystemPrompt(),
      user,
    });
    return parseReviewResponse(raw);
  }

  private async fix(
    brief: PilotBrief,
    template: PageTemplate,
    html: string,
    issues: string[],
  ): Promise<string> {
    const user = [
      "The reviewer requested changes to the page below. Fix every issue listed, keep everything",
      "else that already satisfies the brief, and output only the full corrected HTML document —",
      "no commentary, no markdown code fences.",
      "",
      `Issues to fix:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
      "",
      `Brief goal: ${brief.goal}`,
      `Style guidance: ${template.styleGuidance}`,
      "",
      "--- current HTML ---",
      html,
    ].join("\n");
    return this.builderModel.complete({ system: this.buildSystemPrompt(), user });
  }
}

/**
 * Parses the evaluator's fixed-format response. Deliberately strict rather than free-form JSON —
 * a plain-text protocol the model is told to follow exactly, checked with a regex, same spirit as
 * `packages/hermes/src/toneFilter.ts`'s deterministic parsing over trusting free-form structure.
 */
export function parseReviewResponse(raw: string): ReviewResult {
  const trimmed = raw.trim();
  if (/^VERDICT:\s*APPROVED\b/i.test(trimmed)) {
    return { verdict: "approved", issues: [] };
  }

  const verdictMatch = /^VERDICT:\s*CHANGES_REQUESTED\b/i.test(trimmed);
  if (!verdictMatch) {
    // The evaluator didn't follow the protocol — treat as changes requested, never silently
    // approve on an unparseable response. Human-legible, no fabricated confidence.
    return {
      verdict: "changes_requested",
      issues: [`Evaluator response did not follow the VERDICT protocol: "${trimmed.slice(0, 200)}"`],
    };
  }

  const issuesBlockMatch = trimmed.match(/ISSUES:\s*([\s\S]*)$/i);
  const issues = issuesBlockMatch
    ? issuesBlockMatch[1]!
        .split("\n")
        .map((line) => line.replace(/^[-*]\s*/, "").trim())
        .filter((line) => line.length > 0)
    : [];

  return {
    verdict: "changes_requested",
    issues: issues.length > 0 ? issues : ["Evaluator requested changes but listed no specific issues."],
  };
}
