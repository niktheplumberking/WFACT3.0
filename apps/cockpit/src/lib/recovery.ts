/**
 * Build recovery (Step 4D): for a run that stopped, say in plain words WHY, WHAT IS SAVED, and the ONE thing to press
 * to carry on from where it left off. A pure function over the job row (and its siblings), so it is unit-tested without a
 * database and works for old runs as well as new ones. Nothing here invents state: every claim reads the job's own
 * `error`, `result.status`, `result.qaIssues`, `result.progress` and `result.lastCheckpoint`.
 *
 * Why a run stopped, as the owner needs to hear it (the catalogue is in docs/BUILD-RECOVERY-DESIGN.md §2):
 *   info       something is missing that only the owner or the client can supply (a phone number, real customer quotes)
 *   money      the site builder has no credits left
 *   setup      the factory worker is not set up for this (a missing key or token, a spending limit): Huraira's job
 *   temporary  something outside the factory hiccuped (network, gateway, GitHub): trying again is the fix
 *   fixable    the checks found problems the builder can correct itself on another round
 *   factory    the factory's own rules or code contradict each other: only Huraira can fix it
 *   unknown    none of the above; say so honestly and offer the safe options
 */
import { isStaleRunning, type JobRow } from "../jobsClient";
import { KIND_LABEL, explainJobError, shortId } from "./model";
import { SLOTS, type PlanInputRow } from "./inputs";

export type Cause = "info" | "money" | "setup" | "temporary" | "fixable" | "factory" | "unknown";
export type Saved = "none" | "built" | "verified" | "unknown";

export interface Need {
  key: string;
  label: string;
  hint: string;
  multiline: boolean;
  /** Why the factory asks (shown in the owner's words). */
  why: string;
  kind: "fact" | "answer";
}

export interface Diagnosis {
  cause: Cause;
  /** Completes "Build stopped: …". */
  headline: string;
  happened: string;
  saved: Saved;
  /** One sentence on what is kept and what pressing the button does. */
  savedText: string;
  /** How "carry on" is performed: reopen the saved run, or run the same request again. null = nothing sensible to press. */
  carryOn: "continue" | "rerun" | null;
  /** The button's words. */
  carryOnLabel: string;
  /** What the owner must provide first (empty for most causes). */
  needs: Need[];
  /** True when the same stop has happened again and again, so another try is unlikely to help. */
  repeating: boolean;
  /** Only Huraira can fix the cause: lead with the report. */
  reportFirst: boolean;
  /** Who acts. */
  actor: "you" | "huraira";
}

const BUILD_KINDS = new Set(["build_plan", "resume"]);

const MONEY = /credits exhausted|HTTP 402|insufficient_quota|credit balance|out of credits/i;
const SPEND = /spend:\$|ceiling of \$/i;
const SETUP =
  /GITHUB_DISPATCH_TOKEN|Dispatcher not configured|is not set \(Doppler|builder models unavailable|no Track B builder|CrossModelViolation|same vendor as the builder|no evaluator model was configured|needs AGENT37|API key|HTTP 40[13]\b/i;
const TEMPORARY =
  /no response|fetch failed|HTTP 5\d\d|HTTP 429|upstream_unreachable|after 4 attempts|runner crashed|artifact upload failed|AuditWriteError|timed? ?out|ECONNRESET|a required review could not run|GitHub dispatch failed \(HTTP 5|VERDICT protocol/i;
const FACTORY =
  /permission denied for role|CheckpointIntegrityError|isolated Track B build failed|InvalidBriefError|Brief (is missing|"|ownerFacts)|clientSlug must be|sandbox-exec|unshare|refusing to build|input failed the agent's schema|Lighthouse could not measure|is outside clients\//i;
const FIXABLE = /content was still invalid|round cap|without reviewer approval|QA still failing|verification (rejected|failed)/i;

/** A run the worker never reported on (killed at GitHub's time limit, crashed) is treated as stopped, with the reason said plainly. */
export function asStopped(j: JobRow, now = Date.now()): JobRow {
  if (!isStaleRunning(j, now)) return j;
  return { ...j, status: "failed", error: j.error ?? "runner crashed before recording a result (it stopped reporting; most likely GitHub's 30-minute limit)" };
}

/** Where a run stands, read from its own audit rows (same rules as the runner's `runProgress`). Works for runs from before Step 4D. */
export interface AuditRow {
  action: string;
  payload: Record<string, unknown> | null;
}
export function progressFromAudit(rows: AuditRow[]): { saved: Saved; savedCycle: number | null; reopens: number; state: "running" | "halted" | "gate"; haltStatus: string | null } {
  const last = rows.map((r) => r.action).lastIndexOf("workflow.reopen");
  const epoch = last >= 0 ? rows.slice(last + 1) : rows;
  const end = epoch.find((r) => r.action === "workflow.halt" || r.action === "workflow.gate");
  const cps = rows.filter((r) => r.action === "workflow.checkpoint");
  const lastCp = cps.at(-1);
  return {
    saved: !lastCp ? "none" : lastCp.payload?.stage === "verified" ? "verified" : "built",
    savedCycle: lastCp ? Number(lastCp.payload?.cycle) : null,
    reopens: rows.filter((r) => r.action === "workflow.reopen").length,
    state: !end ? "running" : end.action === "workflow.gate" ? "gate" : "halted",
    haltStatus: end?.action === "workflow.halt" ? ((end.payload?.status as string | undefined) ?? null) : null,
  };
}

function resultOf(j: Pick<JobRow, "result">): Record<string, unknown> {
  return (j.result ?? {}) as Record<string, unknown>;
}

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** What the factory had saved when it stopped. New runs say so (`result.progress`); older ones are read from the checkpoint. */
export function savedState(j: Pick<JobRow, "result" | "kind" | "status">): Saved {
  const r = resultOf(j);
  const p = r.progress as { saved?: string } | null | undefined;
  if (p && (p.saved === "none" || p.saved === "built" || p.saved === "verified")) return p.saved;
  const cp = r.lastCheckpoint as { stage?: string } | null | undefined;
  if (cp && typeof cp === "object") return cp.stage === "verified" ? "verified" : "built";
  if (r.status === "crashed" && typeof r.workflowRunId === "string") return "unknown";
  return "none";
}

const SLOT_BY_KEY = new Map(SLOTS.map((s) => [s.key, s]));

function slotNeed(key: string, why: string): Need {
  const s = SLOT_BY_KEY.get(key)!;
  return { key: s.key, label: s.label, hint: s.hint, multiline: s.multiline, why, kind: "fact" };
}

/** Which missing details the failure names. Reads the failed checks and the evaluator's own notes; never guesses beyond them. */
export function detectNeeds(j: Pick<JobRow, "result" | "error">): Need[] {
  const r = resultOf(j);
  const issues = strArr(r.qaIssues);
  const text = `${issues.join("\n")}\n${j.error ?? ""}`;
  const out = new Map<string, Need>();
  const add = (n: Need) => out.has(n.key) || out.set(n.key, n);

  const unsourced = issues.filter((i) => /claims\.unsourced-fact|not in the brief|no source|unsourced/i.test(i)).join("\n");
  if (unsourced) {
    if (/phone|telephone|\bcall\b/i.test(unsourced)) add(slotNeed("phone", "The checks found a phone number on the site that nobody gave us."));
    if (/e-?mail/i.test(unsourced)) add(slotNeed("email", "The checks found an email address on the site that nobody gave us."));
    if (/address|street|suburb/i.test(unsourced)) add(slotNeed("address", "The checks found an address on the site that nobody gave us."));
    if (/hours|opening|open (mon|tue|wed|thu|fri|sat|sun)/i.test(unsourced)) add(slotNeed("hours", "The checks found opening hours on the site that nobody gave us."));
    if (/service area|areas?\b/i.test(unsourced)) add(slotNeed("service_areas", "The checks found service areas on the site that nobody gave us."));
    if (/price|\$\d|from-price|cost/i.test(unsourced)) add(slotNeed("pricing", "The checks found prices on the site that nobody gave us."));
  }
  if (/testimonial|customer words|social proof/i.test(text) && /(missing|requires|required|no quotes|without)/i.test(text)) {
    add(slotNeed("quotes", "The site is meant to show customer words, and the factory never invents them."));
  }
  // The evaluator's own words about what the client still has to supply: each becomes a question.
  for (const line of strArr(r.needsFromClient)) {
    const label = line.length > 120 ? `${line.slice(0, 117)}...` : line;
    const key = `need_${[...line].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36)}`;
    add({ key, label, hint: "Type the answer exactly as it should appear on the site.", multiline: true, why: "The final review said the client still has to supply this.", kind: "answer" });
  }
  return [...out.values()];
}

/** Needs that are still unanswered: not given, and not deliberately skipped. */
export function unansweredNeeds(needs: Need[], current: PlanInputRow[]): Need[] {
  const done = new Set(current.filter((c) => c.waived || (c.value ?? "").trim() !== "").map((c) => c.key));
  return needs.filter((n) => !done.has(n.key));
}

function classify(j: JobRow, needs: Need[]): Cause {
  const r = resultOf(j);
  const status = typeof r.status === "string" ? r.status : "";
  const text = `${j.error ?? ""}\n${strArr(r.qaIssues).join("\n")}`;
  if (MONEY.test(text)) return "money";
  if (SPEND.test(text)) return "setup";
  if (SETUP.test(text) && !/a required review could not run/i.test(text)) return "setup";
  if (status === "checkpoint_corrupt") return "temporary";
  if (needs.length > 0) return "info";
  if (status === "crashed" || TEMPORARY.test(text)) return "temporary";
  if (FACTORY.test(text)) return "factory";
  if (status === "failed_verification" || FIXABLE.test(text)) return "fixable";
  return "unknown";
}

const SAVED_TEXT: Record<Saved, string> = {
  none: "Nothing was saved before it stopped, so carrying on writes the site again from the plan.",
  built: "The site it had built is saved. Carrying on keeps that site and works from it, so the writing is not paid for twice.",
  verified: "The site passed every check and is saved. There is nothing to fix.",
  unknown: "The run's own record decides what was saved; carrying on picks up from there.",
};

/**
 * `siblings`: every job of the same plan, newest first (including this one), used only to notice that the same stop keeps
 * repeating. A run that was superseded by a later passing build is the caller's concern, not this function's.
 */
export function diagnoseJob(j: JobRow, siblings: JobRow[] = [], opts: { planId?: string | null } = {}): Diagnosis {
  const r = resultOf(j);
  const isBuild = BUILD_KINDS.has(j.kind);
  const needs = isBuild ? detectNeeds(j) : [];
  const cause = classify(j, needs);
  const base = explainJobError(j);
  const saved = savedState(j);
  const runId = typeof r.workflowRunId === "string" ? r.workflowRunId : null;
  const status = typeof r.status === "string" ? r.status : "";
  const spend = SPEND.test(j.error ?? "");

  let headline = base.headline;
  let happened = base.happened;
  let label = "Try again";

  switch (cause) {
    case "info":
      headline = "it needs a few details";
      happened =
        "The factory built what it could, then found it was missing details only you or the client can give (a phone number, real customer quotes). It will not invent them, because a made-up fact on a client's site is a real problem.";
      label = "Save the details and continue";
      break;
    case "money":
      headline = "the site builder is out of credits";
      happened = "Agent 37, the service that writes the site, refused the job because the account has no AI credits left. Nothing was published.";
      label = "I've added credits, continue";
      break;
    case "setup":
      headline = spend ? "the build reached its spending limit" : "the factory worker isn't set up for this";
      happened = spend
        ? "The build used up the money set aside for one build, so it stopped on purpose. Nothing was published."
        : base.headline === "something went wrong"
          ? "A key, token or setting the factory worker needs is missing. Nothing ran, and nothing was published."
          : base.happened;
      label = "Try again (after it's set up)";
      break;
    case "temporary":
      headline = status === "checkpoint_corrupt" ? "the saved copy of the site didn't match" : base.headline === "something went wrong" ? "a connection dropped" : base.headline;
      happened =
        status === "checkpoint_corrupt"
          ? "The factory saved the site, but when it went back to check it, the saved files no longer matched. It refuses to check something that changed, by design. The site has to be built again."
          : status === "crashed"
            ? "Something outside the factory stopped it partway (a dropped connection, a service that did not answer, or GitHub running out of time). Nothing is wrong with the plan."
            : base.headline === "something went wrong"
              ? "Something outside the factory (the network, the model service or GitHub) did not answer in time. The factory already waited and tried a few times before stopping. Nothing is wrong with the plan."
              : base.happened;
      label = status === "checkpoint_corrupt" ? "Build it again" : "Try again";
      break;
    case "fixable":
      headline = "the result failed its checks";
      happened = "The factory built it, but the independent checks found problems. The builder can correct them itself; the problems are listed below.";
      label = "Fix it and continue";
      break;
    case "factory":
      headline = "the factory hit a problem of its own";
      happened =
        "This is not something you or the client did. A rule inside the factory contradicts itself, or part of it is broken. Trying again will probably stop in the same place. Huraira needs to fix it.";
      label = "Try again anyway";
      break;
    case "unknown":
      break;
  }

  // How to carry on. A run that still has a record and can be trusted continues; otherwise the same request runs again.
  const reopenable = isBuild && runId !== null && saved !== "verified" && status !== "checkpoint_corrupt";
  let carryOn: Diagnosis["carryOn"] = null;
  if (reopenable) carryOn = "continue";
  else if (isBuild) carryOn = saved === "verified" ? null : opts.planId ? "rerun" : null;
  else carryOn = "rerun";

  // The same stop, again and again: say so and stop dangling the same button.
  let repeating = false;
  if (isBuild && (cause === "fixable" || cause === "temporary" || cause === "unknown" || cause === "factory")) {
    let n = 0;
    for (const s of siblings) {
      if (!BUILD_KINDS.has(s.kind) || s.status === "cancelled" || s.status === "queued") continue;
      if (s.status === "failed" && sameStop(s, j)) n += 1;
      else break;
    }
    repeating = n >= 3;
  }

  return {
    cause,
    headline,
    happened,
    saved,
    savedText: SAVED_TEXT[saved],
    carryOn,
    carryOnLabel: label,
    needs,
    repeating,
    reportFirst: cause === "factory" || repeating,
    actor: cause === "factory" || cause === "setup" ? "huraira" : "you",
  };
}

/** Two stops are "the same" when they ended in the same status and the same first words of the error. */
function sameStop(a: JobRow, b: JobRow): boolean {
  const key = (j: JobRow) => `${resultOf(j).status ?? ""}|${(j.error ?? "").replace(/[0-9a-f]{8}-[0-9a-f-]{27}|\d+/gi, "#").slice(0, 80)}`;
  return key(a) === key(b);
}

/** What goes to the job queue when the owner presses the button. Always an ordinary request; the database checks who may ask. */
export function carryOnRequest(j: JobRow, d: Diagnosis, planId: string | null): { kind: JobRow["kind"]; params: Record<string, unknown> } | null {
  const r = resultOf(j);
  if (d.carryOn === "continue" && typeof r.workflowRunId === "string") {
    return {
      kind: "resume",
      params: { workflowRunId: r.workflowRunId, ...(planId ? { planId } : {}), reopen: true, reason: `Continued from the Cockpit after: ${d.headline}`.slice(0, 200) },
    };
  }
  if (d.carryOn === "rerun") {
    if (j.kind === "build_plan" || j.kind === "resume") return planId ? { kind: "build_plan", params: { planId } } : null;
    return { kind: j.kind, params: j.params };
  }
  return null;
}

/** A short plain-text report the owner can paste to Huraira: what ran, what it said, what is saved. */
export function reportText(j: JobRow, d: Diagnosis, planName: string | null): string {
  const r = resultOf(j);
  const issues = strArr(r.qaIssues).slice(0, 8);
  return [
    "WFACT build report",
    `Build: ${planName ?? KIND_LABEL[j.kind]}`,
    `Request: ${shortId(j.id)} (${KIND_LABEL[j.kind]}), ${j.created_at}`,
    typeof r.workflowRunId === "string" ? `Run: ${shortId(r.workflowRunId)} (${r.workflowRunId})` : "Run: none",
    `What the Cockpit told the owner: ${d.headline}`,
    `Saved: ${d.saved}`,
    `Status: ${typeof r.status === "string" ? r.status : "(none)"}`,
    `Error: ${(j.error ?? "(none)").slice(0, 600)}`,
    ...(issues.length ? ["Failed checks:", ...issues.map((i) => `- ${i.slice(0, 240)}`)] : []),
    j.gh_run_url ? `GitHub run: ${j.gh_run_url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
