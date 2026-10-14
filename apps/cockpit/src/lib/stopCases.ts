/**
 * The stopped build's eight cases (Cockpit v2, brief §7.8), mapped from diagnoseJob() and the run's halt status. Pure, so
 * every case is tested without a database. The case only picks the words and which of continueOptions() is the primary;
 * what is actually sent is still continueOptions() + carryOnRequest() (lib/recovery.ts), unchanged.
 *
 *   1 details nobody gave us        info (needs_input, or details the review asked for)
 *   2 an unsourced fact             info + claims.unsourced-fact (phone, address, prices…)
 *   3 a service did not answer      temporary, the reviewer or a service it needs
 *   4 out of credit / not set up    money, or setup without a spending limit
 *   5 checks still failed           fixable (failed_verification)
 *   6 spending limit reached        setup + spend
 *   7 stopped before saving         anything else, nothing saved
 *   8 stopped part-way, saved       anything else, something saved
 *
 * A problem inside the factory, or the same stop again and again, is not one of the eight: it leads with the note for
 * Huraira, because pressing the same button again will not help.
 */
import type { JobRow } from "../jobsClient";
import type { Diagnosis } from "./recovery";
import { issueLabel } from "./timeline";

export type StopCaseId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | "factory";

export interface StopCase {
  id: StopCaseId;
  title: string;
  /** The primary's words (the brief's table). */
  fix: string;
  /** Who acts, when it is not the viewer. */
  who: string | null;
}

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const REVIEWER = /a required review could not run|qa-evaluator|evaluator|reviewer|VERDICT protocol/i;
const UNSOURCED = /claims\.unsourced-fact|not in the brief|no source|unsourced/i;

export function stopStatus(j: Pick<JobRow, "result">, haltStatus: string | null): string | null {
  const r = (j.result ?? {}) as Record<string, unknown>;
  return haltStatus ?? (typeof r.status === "string" ? r.status : null);
}

export function stopCaseOf(j: Pick<JobRow, "result" | "error">, d: Diagnosis, haltStatus: string | null): StopCase {
  const r = (j.result ?? {}) as Record<string, unknown>;
  const status = stopStatus(j, haltStatus);
  const issues = strArr(r.qaIssues);
  const text = `${j.error ?? ""}\n${typeof r.haltReason === "string" ? r.haltReason : ""}`;
  const spend = /spend:\$|ceiling of \$/i.test(text);

  if (d.cause === "factory" || d.repeating) {
    return {
      id: "factory",
      title: d.repeating ? "It keeps stopping for the same reason" : "The factory hit a problem of its own",
      fix: "Copy a note for Huraira",
      who: d.repeating ? "Trying again is unlikely to change this. Huraira looks into it." : "Huraira fixes this: it is a problem inside the factory, not something you or the client did.",
    };
  }
  if (d.cause === "setup" && spend) return { id: 6, title: "The build used up its spending limit and stopped on purpose", fix: "Ask Nick to raise the limit for this build", who: null };
  if (d.cause === "money" || d.cause === "setup") {
    return {
      id: 4,
      title: "An AI service is out of credit or not set up",
      fix: "Try again once it is set up",
      who: d.cause === "money" ? "Huraira adds credit to the site builder account." : "Huraira sets this up: it is a setting on the factory worker, not something you or the client did.",
    };
  }
  if (d.cause === "info") {
    const facts = d.needs.filter((x) => x.kind === "fact");
    if (issues.some((i) => UNSOURCED.test(i)) && facts.length > 0) {
      const what = facts.length === 1 ? `a ${facts[0]!.label.toLowerCase()}` : "details";
      return { id: 2, title: `The checks found ${what} on the site that nobody gave us`, fix: "Fix it and continue", who: null };
    }
    return { id: 1, title: "The site needs details nobody gave us", fix: "Save the details and continue", who: null };
  }
  if (d.cause === "temporary" && status !== "checkpoint_corrupt" && (REVIEWER.test(text) || status === "not_verified_no_evaluator" || status === "provider_unavailable")) {
    const reviewer = REVIEWER.test(text) || status === "not_verified_no_evaluator";
    return {
      id: 3,
      title: reviewer ? "The reviewer did not answer" : "A service it needs did not answer",
      fix: d.saved === "built" ? "Check again without changes" : "Try again",
      who: null,
    };
  }
  if (d.cause === "fixable") return { id: 5, title: "The checks still failed after the last round of fixes", fix: "Fix it and continue", who: null };
  if (d.saved === "none" || status === "checkpoint_corrupt") return { id: 7, title: "It stopped before saving anything", fix: "Write the site again from the proposal", who: null };
  return { id: 8, title: "It stopped part-way. The saved site is safe", fix: "Continue from where it stopped", who: null };
}

/** The checks that still fail, in plain words (one per check). */
export function failedChecks(j: Pick<JobRow, "result">): string[] {
  const r = (j.result ?? {}) as Record<string, unknown>;
  return [...new Set(strArr(r.qaIssues).map(issueLabel))];
}

/** The checks' own words, without their ids: the "Why?" evidence. */
export function evidenceOf(j: Pick<JobRow, "result">, d: Diagnosis): string {
  const r = (j.result ?? {}) as Record<string, unknown>;
  const issues = strArr(r.qaIssues).map((i) => i.replace(/^\s*\[[a-z0-9.:_-]+\]\s*/i, "").trim()).filter(Boolean);
  if (issues.length) return issues.slice(0, 3).join(" ");
  const missing = d.needs.map((n) => n.label.toLowerCase());
  if (missing.length) return `Missing: ${missing.join(", ")}.`;
  return d.happened;
}
