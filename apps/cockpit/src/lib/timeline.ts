/**
 * The step-by-step story of one build, read from the run's own audit trail (BUILD-SPEED-UX P1, build progress UX).
 *
 * A pure function over audit rows (+ the job row and the plan's decision), so it is unit-tested without a database and
 * works for old runs (no readiness check, no `fromStep`) as well as new ones. Nothing here invents state: a step is
 * "done" only when its own row says so, and a run that died without a halt row is shown as stopped, not as running.
 *
 * Rows used (all on run_id = workflowRunId):
 *   workflow.start {maxQaRevisions}            workflow.preflight {ok, needs[], checks[]}
 *   agent.spawn / agent.complete|escalate|reject {role, attempts, durationMs}   (roles front-end-builder, qa-evaluator)
 *   workflow.checkpoint {stage, cycle}         verification.decision {status, checks[]}
 *   workflow.return_to_builder {cycle, issues} workflow.halt {status, stage}   workflow.gate {gate:"launch"}
 *   workflow.reopen {by, fromStatus, baseCycle, fromStep?}  (a "continue": starts a new segment)
 */
import type { JobRow } from "../jobsClient";

export interface RunRow {
  action: string;
  occurred_at: string;
  task_id?: string | null;
  payload: Record<string, unknown> | null;
}

export type StepState = "done" | "running" | "failed" | "skipped" | "pending";
export type StepKind = "plan" | "start" | "preflight" | "build" | "saved" | "qa" | "gate" | "continued" | "crash";
/** Where a stopped build stopped, in the terms the continue options use. */
export type Stage = "preflight" | "build" | "qa";

export interface TimelineStep {
  key: string;
  kind: StepKind;
  label: string;
  state: StepState;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  /** One plain sentence. */
  detail: string | null;
  /** Failed checks (quality steps) or missing details (readiness step), in plain words. */
  problems: string[];
  /** Advisory findings: reported, never blocking (a passed step can carry them). */
  notes?: string[];
  /** Which part of the run this belongs to: 0 = the first go, 1+ = after each "continue". */
  segment: number;
  /** Builder steps: 0 = the first write, n = revision round n. Quality steps: the round they checked. */
  round: number | null;
}

export interface PreflightNeed {
  key: string;
  label: string;
  reason: string;
}

export interface Timeline {
  steps: TimelineStep[];
  /** The step running now (null when nothing is running). */
  current: TimelineStep | null;
  /** The step the build stopped at (null unless it stopped). */
  stopped: TimelineStep | null;
  outcome: "waiting" | "running" | "gate" | "halted" | "crashed" | "cancelled" | "finished";
  haltStatus: string | null;
  stoppedIn: Stage | null;
  maxRounds: number | null;
  /** A built site is saved on this run, so continuing can reuse it. */
  savedSite: boolean;
  preflightNeeds: PreflightNeed[];
  /** True when the steps come from the run's audit rows; false when only the job row was available. */
  fromAudit: boolean;
}

export interface PlanInfo {
  decidedAt: string | null;
  track: string | null;
}

const BUILDER = "front-end-builder";
const QA = "qa-evaluator";

/** Plain names for the checks the factory runs. Unknown ids fall back to a readable version of the id, never a bare slug. */
export const CHECK_LABEL: Record<string, string> = {
  "claims.unsourced-fact": "A fact on the site that nobody gave us",
  "claims.banned": "A claim the factory never makes",
  "claims.sample-label": "Sample text not labelled as sample",
  "claims.after-html": "A claim in the finished page",
  "required-sections": "A required section is missing",
  "image-optimization": "Images too large",
  "isolation-check": "Content from another client",
  "no-console-errors": "Errors in the page's code",
  "responsive-check": "Layout on phones",
  "secrets-scan": "A key or password in the files",
  "a11y.form-labels": "Form fields without labels",
  "a11y.heading-order": "Headings out of order",
  "a11y.html-lang": "Page language not set",
  "content.placeholder-media": "Placeholder images",
  "integrity.duplicate-ids": "Duplicate element ids",
  "integrity.prerendered-content": "Content missing before scripts run",
  "links.site-internal": "Broken links inside the site",
  "sec.dev-urls": "Links to development addresses",
  "sec.mixed-content": "Insecure (http) content",
  "sec.source-maps": "Source code exposed",
  "sec.target-blank": "Unsafe new-tab links",
  "seo.duplicate-titles": "Pages share the same title",
  "seo.meta-description": "Search description missing",
  "seo.open-graph": "Sharing preview missing",
  "seo.single-h1": "Page heading count",
  "seo.title": "Page title",
  "tells.404-page": "No 'page not found' page",
  "tells.canonical": "Canonical address missing",
  "tells.favicon": "Browser tab icon missing",
  "tells.llms-txt": "AI crawler file missing",
  "tells.og-image": "Sharing image missing",
  "tells.robots": "Search engine rules file missing",
  "tells.sitemap": "Sitemap missing",
  "render.a11y": "Accessibility in the browser",
  "render.console": "Errors in the browser",
  "render.design-review": "Design review",
  "render.design-rules": "Design rules",
  "render.js-budget": "Too much script",
  "render.layout": "Layout in the browser",
  "render.links": "Links in the browser",
  "render.load": "Page did not load",
  "render.motion-budget": "Too much motion",
  "render.perf": "Page speed",
  "render.reduced-motion": "Reduced-motion setting ignored",
};

export function checkLabel(id: string): string {
  const known = CHECK_LABEL[id];
  if (known) return known;
  const words = id.replace(/^[a-z0-9]+\./i, "").replace(/[-_.]+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : "A check";
}

/** "[claims.unsourced-fact] The phone number…" → its plain label; anything else is kept, trimmed. */
export function issueLabel(issue: string): string {
  const m = /^\s*\[([a-z0-9.:_-]+)\]/i.exec(issue);
  if (m) return checkLabel(m[1]!);
  return issue.length > 140 ? `${issue.slice(0, 137)}...` : issue;
}

const uniq = (xs: string[]) => [...new Set(xs)];

/** Why a run stopped, in plain words (copy guide rule 3: what happened). */
export const HALT_WORDS: Record<string, string> = {
  needs_input: "It needs some details before it can start. Nothing was spent.",
  provider_unavailable: "A service it depends on (the builder, the reviewer or the evaluator) wasn't ready, so it did not start. Nothing was spent and nothing new was saved.",
  failed_verification: "The checks still found problems after the last revision round, so it stopped and handed over to a person, by design.",
  not_verified_no_evaluator: "The final review couldn't run, so the site isn't marked verified.",
  build_failed: "The builder couldn't finish writing the site.",
  qa_failed: "The quality checks couldn't finish.",
  checkpoint_corrupt: "The saved copy of the site no longer matched, so it can't be checked. It has to be written again.",
  already_finished: "This run had already finished.",
};
export const CRASH_WORDS = "The worker stopped before reporting. Anything it saved is kept.";

const STAGE_OF_STATUS: Record<string, Stage> = {
  needs_input: "preflight",
  provider_unavailable: "preflight",
  failed_verification: "qa",
  not_verified_no_evaluator: "qa",
  qa_failed: "qa",
  checkpoint_corrupt: "qa",
  build_failed: "build",
};

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
/** Rows may come with the whole payload, or with selected fields at the top level (PostgREST `alias:payload->>field`). */
function field(r: RunRow, k: string): unknown {
  const top = (r as unknown as Record<string, unknown>)[k];
  return top !== undefined ? top : r.payload?.[k];
}

function finish(s: TimelineStep, at: string | null, state: StepState, durationMs?: number | null) {
  s.state = state;
  s.finishedAt = at ?? s.finishedAt;
  const d = durationMs ?? (s.startedAt && s.finishedAt ? Math.max(0, ms(s.finishedAt) - ms(s.startedAt)) : null);
  s.durationMs = d;
}

/** "Continued from quality checks by you" / "Continued with fixes by you" / "Built again by you". */
function continuedLabel(fromStep: string | null, who: string, savedSite: boolean): string {
  if (fromStep === "qa") return `Continued from quality checks by ${who}`;
  if (fromStep === "revise") return `Continued with fixes by ${who}`;
  if (fromStep === "rebuild") return `Built again by ${who}`;
  return `Continued by ${who} from ${savedSite ? "the saved site" : "the start"}`;
}

/** A readiness check that failed on a service, not on a missing detail: "provider.builder" etc. */
function providerProblem(c: Record<string, unknown>): string {
  const name = String(c.id ?? "").replace(/^provider\./, "");
  const who = /build/i.test(name) ? "The site builder" : /review/i.test(name) ? "The design reviewer" : /eval/i.test(name) ? "The evaluator" : "A model service";
  const detail = typeof c.detail === "string" && c.detail ? `: ${c.detail.length > 120 ? `${c.detail.slice(0, 117)}...` : c.detail}` : "";
  return `${who} wasn't ready${detail}`;
}

export interface DeriveInput {
  rows: RunRow[];
  job: Pick<JobRow, "status" | "created_at" | "started_at" | "finished_at" | "result" | "kind" | "error">;
  plan?: PlanInfo | null;
  /** Display names for user ids that continued the run. */
  names?: Record<string, string>;
  meId?: string | null;
  /** True while the job is queued/dispatched/running and not stale (caller decides, see jobsClient.isActive). */
  active?: boolean;
  /** True for a queued job that never reached the worker. */
  neverStarted?: boolean;
}

export function deriveTimeline(input: DeriveInput): Timeline {
  const { job, plan } = input;
  const rows = [...input.rows].sort((a, b) => ms(a.occurred_at) - ms(b.occurred_at));
  const steps: TimelineStep[] = [];
  // Keys count per (kind, segment), so a step keeps its key when steps of another kind appear before it (the plan loading
  // late, a pending step turning real): the step's buttons are never remounted under a person's click.
  const seen = new Map<string, number>();
  const push = (s: Omit<TimelineStep, "key" | "problems" | "durationMs" | "finishedAt" | "round"> & Partial<TimelineStep>): TimelineStep => {
    const base = `${s.kind}-${s.segment}`;
    const i = seen.get(base) ?? 0;
    seen.set(base, i + 1);
    const step: TimelineStep = { key: `${base}-${i}`, problems: [], durationMs: null, finishedAt: null, round: null, ...s };
    steps.push(step);
    return step;
  };

  if (plan) push({ kind: "plan", label: "Plan approved", state: "done", startedAt: plan.decidedAt, finishedAt: plan.decidedAt, detail: plan.track ? `Track ${plan.track}.` : null, segment: 0 });

  if (rows.length === 0) return fallback(input, steps, push);

  let seg = 0;
  let segBase = 0;
  let nextBuildCycle = 0;
  let writeAgain = false;
  let maxRounds: number | null = null;
  let savedSite = false;
  let haltStatus: string | null = null;
  let outcome: Timeline["outcome"] = "running";
  let stopped: TimelineStep | null = null;
  let preflightNeeds: PreflightNeed[] = [];
  let lastBuildRound = 0;

  const inSeg = (kind: StepKind) => [...steps].reverse().find((s) => s.segment === seg && s.kind === kind) ?? null;
  const runningOf = (kind: StepKind) => [...steps].reverse().find((s) => s.segment === seg && s.kind === kind && s.state === "running") ?? null;
  const skipPreflight = (at: string) => {
    const p = runningOf("preflight");
    if (p) {
      finish(p, at, "skipped");
      p.detail = "Not checked on this run: it started before the readiness check existed.";
      p.durationMs = null;
    }
  };
  const interruptRunning = (at: string) => {
    for (const s of steps) {
      if (s.segment === seg && s.state === "running" && s.kind !== "preflight") {
        finish(s, at, "failed");
        s.detail = CRASH_WORDS;
      }
    }
  };

  for (const r of rows) {
    const at = r.occurred_at;
    switch (r.action) {
      case "workflow.start": {
        maxRounds = num(field(r, "maxQaRevisions"));
        push({ kind: "preflight", label: "Ready to build", state: "running", startedAt: at, detail: "Checking it has everything it needs before anything is paid for.", segment: seg });
        break;
      }
      case "workflow.preflight": {
        const ok = field(r, "ok") === true;
        const needs = (Array.isArray(field(r, "needs")) ? (field(r, "needs") as unknown[]) : [])
          .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
          .map((x) => ({ key: String(x.key ?? ""), label: String(x.label ?? x.key ?? ""), reason: String(x.reason ?? "") }))
          .filter((x) => x.key);
        let p = inSeg("preflight");
        if (!p || p.state !== "running") p = push({ kind: "preflight", label: "Ready to build", state: "running", startedAt: at, detail: null, segment: seg });
        finish(p, at, ok ? "done" : "failed");
        const failedChecks = (Array.isArray(field(r, "checks")) ? (field(r, "checks") as unknown[]) : []).filter(
          (x): x is Record<string, unknown> => !!x && typeof x === "object" && (x as Record<string, unknown>).ok === false,
        );
        const providers = failedChecks.filter((c) => String(c.id ?? "").startsWith("provider."));
        p.detail = ok
          ? "Everything it needs is here."
          : needs.length === 0 && providers.length > 0
            ? "A service it depends on wasn't ready, so it did not start. Nothing was spent."
            : "Some details are missing, so it did not start. Nothing was spent.";
        p.problems = [...needs.map((x) => x.label), ...providers.map(providerProblem)];
        preflightNeeds = ok ? [] : needs;
        break;
      }
      case "workflow.reopen": {
        interruptRunning(at);
        const by = str(field(r, "by"));
        const fromStep = str(field(r, "fromStep"));
        const who = by === "auto" ? "automatic retry" : by && by === input.meId ? "you" : (by && input.names?.[by]) || "a teammate";
        seg += 1;
        segBase = num(field(r, "baseCycle")) ?? 0;
        writeAgain = fromStep === "rebuild" || !savedSite;
        nextBuildCycle = writeAgain ? segBase : segBase + 1;
        haltStatus = null;
        outcome = "running";
        stopped = null;
        preflightNeeds = [];
        push({ kind: "continued", label: continuedLabel(fromStep, who, savedSite), state: "done", startedAt: at, finishedAt: at, detail: null, segment: seg });
        break;
      }
      case "agent.spawn": {
        const role = str(field(r, "role"));
        if (role !== BUILDER && role !== QA) break;
        skipPreflight(at);
        interruptRunning(at);
        if (role === BUILDER) {
          const rev = writeAgain ? 0 : Math.max(0, nextBuildCycle - segBase);
          const label = rev > 0 ? `Revision round ${rev}${maxRounds ? ` of ${maxRounds}` : ""}` : seg === 0 && !writeAgain ? "Writing the site" : "Writing the site again";
          const detail = rev > 0 ? "Fixing the problems the checks found, on the saved site." : seg > 0 ? "Writing from the approved plan." : null;
          lastBuildRound = rev;
          push({ kind: "build", label, state: "running", startedAt: at, detail, segment: seg, round: rev });
        } else {
          push({ kind: "qa", label: lastBuildRound > 0 ? `Quality checks on revision ${lastBuildRound}` : "Quality checks", state: "running", startedAt: at, detail: null, segment: seg, round: lastBuildRound });
        }
        break;
      }
      case "agent.complete":
      case "agent.escalate":
      case "agent.reject": {
        const role = str(field(r, "role"));
        if (role !== BUILDER && role !== QA) break;
        const kind: StepKind = role === BUILDER ? "build" : "qa";
        let s = runningOf(kind);
        if (!s) s = push({ kind, label: kind === "build" ? "Writing the site" : "Quality checks", state: "running", startedAt: at, detail: null, segment: seg, round: kind === "build" ? 0 : lastBuildRound });
        const d = num(field(r, "durationMs"));
        if (r.action === "agent.complete") {
          finish(s, at, "done", d);
          if (kind === "build" && !s.detail) s.detail = "Written.";
        } else {
          finish(s, at, "failed", d);
          const attempts = num(field(r, "attempts"));
          s.detail = kind === "build" ? `The builder gave up${attempts ? ` after ${attempts} attempt${attempts === 1 ? "" : "s"}` : ""}.` : "The quality checks couldn't finish.";
        }
        break;
      }
      case "verification.decision": {
        const s = inSeg("qa");
        if (!s) break;
        const status = str(field(r, "status"));
        const checks = Array.isArray(field(r, "checks")) ? (field(r, "checks") as { checkId?: string; passed?: boolean; advisory?: boolean }[]) : [];
        const failing = checks.filter((c) => c && c.passed === false && typeof c.checkId === "string");
        // Advisory findings never block. Rows written before the flag existed: on an approved result every failing check was advisory.
        const isNote = (c: { advisory?: boolean }) => c.advisory === true || status === "approved";
        const failed = uniq(failing.filter((c) => !isNote(c)).map((c) => checkLabel(c.checkId!)));
        s.problems = failed;
        const notes = uniq(failing.filter(isNote).map((c) => checkLabel(c.checkId!)));
        if (notes.length > 0) s.notes = notes;
        s.detail =
          status === "approved"
            ? "Every check passed."
            : status === "blocked_no_evaluator"
              ? "The automatic checks ran, but the final review couldn't."
              : failed.length
                ? `Found ${failed.length} problem${failed.length === 1 ? "" : "s"} to fix.`
                : "Found problems to fix.";
        break;
      }
      case "workflow.checkpoint": {
        savedSite = true;
        if (field(r, "stage") === "verified") break;
        const cycle = num(field(r, "cycle")) ?? 0;
        const rev = writeAgain ? 0 : Math.max(0, cycle - segBase);
        writeAgain = false;
        push({
          kind: "saved",
          label: rev > 0 ? `Saved revision ${rev}` : "Saved",
          state: "done",
          startedAt: at,
          finishedAt: at,
          detail: "Kept safely. Continuing from here does not pay for the writing again.",
          segment: seg,
          round: rev,
        });
        break;
      }
      case "workflow.return_to_builder": {
        const cycle = num(field(r, "cycle")) ?? 0;
        nextBuildCycle = cycle + 1;
        writeAgain = false;
        const s = inSeg("qa");
        const issues = Array.isArray(field(r, "issues")) ? (field(r, "issues") as unknown[]).filter((x): x is string => typeof x === "string") : [];
        if (s && s.problems.length === 0 && issues.length) {
          s.problems = uniq(issues.map(issueLabel));
          s.detail = `Found ${s.problems.length} problem${s.problems.length === 1 ? "" : "s"} to fix.`;
        }
        break;
      }
      case "workflow.halt": {
        const status = str(field(r, "status")) ?? "unknown";
        const stage = (str(field(r, "stage")) as Stage | null) ?? STAGE_OF_STATUS[status] ?? null;
        haltStatus = status;
        outcome = "halted";
        const kind: StepKind = stage === "preflight" ? "preflight" : stage === "build" ? "build" : "qa";
        let s = inSeg(kind);
        // The last step of this kind belongs to an earlier round when the site was written or saved after it.
        const stale = !!s && s.state !== "running" && steps.slice(steps.indexOf(s) + 1).some((x) => x.segment === seg && (x.kind === "build" || x.kind === "saved"));
        if (!s || stale) {
          s = push({ kind, label: kind === "preflight" ? "Ready to build" : kind === "build" ? "Writing the site" : "Quality checks", state: "running", startedAt: at, detail: null, segment: seg });
        }
        finish(s, s.state === "running" ? at : s.finishedAt, "failed", s.durationMs);
        s.detail = HALT_WORDS[status] ?? "It stopped and handed over to a person.";
        stopped = s;
        break;
      }
      case "workflow.gate": {
        haltStatus = "awaiting_launch_approval";
        outcome = "gate";
        savedSite = true;
        push({ kind: "gate", label: "Ready for launch approval", state: "done", startedAt: at, finishedAt: at, detail: "Every check passed. Launch is a person's decision, made outside the Cockpit.", segment: seg });
        break;
      }
      default:
        break;
    }
  }

  // A run whose job has ended without an end row: the worker stopped before it could report.
  const jobEnded = job.status === "failed" || job.status === "succeeded" || job.status === "cancelled";
  if (outcome === "running" && jobEnded && !input.active) {
    const running = [...steps].reverse().find((s) => s.state === "running" && s.segment === seg);
    const slack = 2 * 60_000;
    const belongsToThisJob = !running || !job.finished_at || ms(running.startedAt) <= ms(job.finished_at) + slack;
    if (belongsToThisJob) {
      const rs = (job.result ?? {}) as Record<string, unknown>;
      const resultStatus = typeof rs.status === "string" ? rs.status : null;
      if (resultStatus && HALT_WORDS[resultStatus] && resultStatus !== "already_finished") haltStatus = resultStatus;
      if (running) {
        finish(running, job.finished_at, "failed");
        running.detail = haltStatus && HALT_WORDS[haltStatus] ? HALT_WORDS[haltStatus]! : CRASH_WORDS;
        stopped = running;
      } else if (job.status !== "succeeded") {
        const last = steps.at(-1);
        stopped = push({ kind: "crash", label: "Stopped without reporting", state: "failed", startedAt: last?.finishedAt ?? last?.startedAt ?? null, finishedAt: job.finished_at, detail: CRASH_WORDS, segment: seg });
      }
      if (stopped) outcome = haltStatus ? "halted" : "crashed";
      else outcome = "finished";
    }
  }

  // A new job continuing this run that the worker has not picked up yet.
  if (input.active && outcome !== "running") {
    push({ kind: "start", label: "Waiting for the factory worker", state: "running", startedAt: job.started_at ?? job.created_at, detail: "A continue was requested; the worker usually picks it up within a minute.", segment: seg + 1 });
    outcome = "running";
    stopped = null;
  }

  if (outcome === "running") addPending(steps, push, seg, maxRounds);

  const current = outcome === "running" ? ([...steps].reverse().find((s) => s.state === "running") ?? null) : null;
  return {
    steps,
    current,
    stopped,
    outcome,
    haltStatus,
    stoppedIn: stopped ? stageOf(stopped, steps, haltStatus) : null,
    maxRounds,
    savedSite,
    preflightNeeds,
    fromAudit: true,
  };
}

type Push = (s: Omit<TimelineStep, "key" | "problems" | "durationMs" | "finishedAt" | "round"> & Partial<TimelineStep>) => TimelineStep;

/** While running, show what is still to come (greyed), so the person can see how far along it is. */
function addPending(steps: TimelineStep[], push: Push, seg: number, maxRounds: number | null) {
  void maxRounds;
  const last = [...steps].reverse().find((s) => s.kind !== "plan");
  const k = last?.kind;
  const segNow = last?.segment ?? seg;
  const pend = (kind: StepKind, label: string) => push({ kind, label, state: "pending", startedAt: null, detail: null, segment: segNow });
  if (!last || k === "start" || k === "preflight" || k === "continued") {
    pend("build", "Writing the site");
    pend("qa", "Quality checks");
  } else if (k === "build") {
    pend("saved", "Saved");
    pend("qa", "Quality checks");
  } else if (k === "saved") {
    pend("qa", "Quality checks");
  }
  pend("gate", "Ready for launch approval");
}

function stageOf(s: TimelineStep, steps: TimelineStep[], haltStatus: string | null): Stage | null {
  if (haltStatus && STAGE_OF_STATUS[haltStatus]) return STAGE_OF_STATUS[haltStatus]!;
  if (s.kind === "preflight") return "preflight";
  if (s.kind === "build") return "build";
  if (s.kind === "qa") return "qa";
  if (s.kind === "crash") {
    const prev = [...steps].reverse().find((x) => x !== s && (x.kind === "build" || x.kind === "qa" || x.kind === "saved"));
    if (!prev) return "build";
    if (prev.kind === "saved") return "qa";
    if (prev.kind === "qa") return prev.problems.length ? "build" : "qa";
    return "build";
  }
  return null;
}

/** No audit rows (an old run, a run the reader can't see, or a job that never reached the worker): say what the job row knows. */
function fallback(input: DeriveInput, steps: TimelineStep[], push: Push): Timeline {
  const { job } = input;
  const r = (job.result ?? {}) as Record<string, unknown>;
  const status = typeof r.status === "string" ? r.status : null;
  const progress = r.progress as { saved?: string } | undefined;
  const cp = r.lastCheckpoint as { stage?: string } | null | undefined;
  const saved = progress?.saved ?? (cp && typeof cp === "object" ? (cp.stage === "verified" ? "verified" : "built") : status === "crashed" ? "unknown" : "none");
  const base: Omit<Timeline, "steps" | "current" | "stopped" | "outcome" | "stoppedIn"> = {
    haltStatus: status && (HALT_WORDS[status] || status === "awaiting_launch_approval") ? status : null,
    maxRounds: null,
    savedSite: saved === "built" || saved === "verified",
    preflightNeeds: [],
    fromAudit: false,
  };
  const done = (t: Partial<Timeline> & Pick<Timeline, "outcome">): Timeline => ({ ...base, steps, current: null, stopped: null, stoppedIn: null, ...t });

  if (input.neverStarted) {
    const s = push({ kind: "start", label: "Never reached the factory worker", state: "failed", startedAt: job.created_at, detail: "The hand-off to the worker never landed. Start it again or close it.", segment: 0 });
    return done({ outcome: "crashed", stopped: s, stoppedIn: null });
  }
  if (job.status === "cancelled") {
    push({ kind: "start", label: "Cancelled", state: "skipped", startedAt: job.created_at, finishedAt: job.finished_at, detail: null, segment: 0 });
    return done({ outcome: "cancelled" });
  }
  if (input.active || job.status === "queued" || job.status === "dispatched" || job.status === "running") {
    const started = job.status === "running" && job.started_at;
    const s = push({
      kind: "start",
      label: started ? "Getting ready" : "Waiting for the factory worker",
      state: "running",
      startedAt: started ? job.started_at : job.created_at,
      detail: started ? "The worker has started and is setting up." : "The worker usually picks it up within a minute.",
      segment: 0,
    });
    addPending(steps, push, 0, null);
    return done({ outcome: started ? "running" : "waiting", current: s });
  }
  if (job.status === "succeeded" || status === "awaiting_launch_approval") {
    push({ kind: "build", label: "Writing the site", state: "done", startedAt: job.started_at, detail: null, segment: 0 });
    push({ kind: "qa", label: "Quality checks", state: "done", startedAt: null, detail: "Every check passed.", segment: 0 });
    push({ kind: "gate", label: "Ready for launch approval", state: "done", startedAt: job.finished_at, finishedAt: job.finished_at, detail: "Launch is a person's decision, made outside the Cockpit.", segment: 0 });
    return done({ outcome: "gate", haltStatus: "awaiting_launch_approval", savedSite: true });
  }
  // Failed.
  const words = status && HALT_WORDS[status] ? HALT_WORDS[status]! : status === "crashed" || /runner crashed/i.test(job.error ?? "") ? CRASH_WORDS : "It stopped here.";
  if (status === "needs_input") {
    const s = push({ kind: "preflight", label: "Ready to build", state: "failed", startedAt: job.started_at, finishedAt: job.finished_at, detail: words, segment: 0 });
    return done({ outcome: "halted", stopped: s, stoppedIn: "preflight" });
  }
  if (saved === "unknown") {
    const s = push({ kind: "crash", label: "Stopped without reporting", state: "failed", startedAt: job.started_at, finishedAt: job.finished_at, detail: CRASH_WORDS, segment: 0 });
    return done({ outcome: "crashed", stopped: s, stoppedIn: null });
  }
  if (saved === "none") {
    const s = push({ kind: "build", label: "Writing the site", state: "failed", startedAt: job.started_at, finishedAt: job.finished_at, detail: words, segment: 0 });
    push({ kind: "qa", label: "Quality checks", state: "skipped", startedAt: null, detail: "Not reached.", segment: 0 });
    return done({ outcome: base.haltStatus ? "halted" : "crashed", stopped: s, stoppedIn: "build" });
  }
  push({ kind: "build", label: "Writing the site", state: "done", startedAt: job.started_at, detail: null, segment: 0 });
  push({ kind: "saved", label: "Saved", state: "done", startedAt: null, detail: "Kept safely. Continuing from here does not pay for the writing again.", segment: 0 });
  const qaIssues = Array.isArray(r.qaIssues) ? (r.qaIssues as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const s = push({ kind: "qa", label: "Quality checks", state: "failed", startedAt: null, finishedAt: job.finished_at, detail: words, segment: 0, problems: uniq(qaIssues.map(issueLabel)) });
  return done({ outcome: base.haltStatus ? "halted" : "crashed", stopped: s, stoppedIn: "qa" });
}

/* ---------------- live: elapsed, the current wait, estimate, stall ---------------- */

/** "45 s", "1 min 10 s", "12 min". */
export function formatMs(v: number): string {
  const s = Math.max(0, Math.round(v / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m >= 10) return `${m} min`;
  return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
}

export function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

export const MIN_PAST_RUNS = 3;

export type Estimate = { kind: "ok"; medianMs: number; runs: number } | { kind: "insufficient"; runs: number };

/** "Usually takes about X" from the median of past succeeded runs of the same track; fewer than 3 runs is not enough to say. */
export function estimate(pastDurationsMs: number[]): Estimate {
  const v = pastDurationsMs.filter((x) => Number.isFinite(x) && x > 0);
  if (v.length < MIN_PAST_RUNS) return { kind: "insufficient", runs: v.length };
  return { kind: "ok", medianMs: median(v)!, runs: v.length };
}

export function estimateText(e: Estimate): string {
  return e.kind === "ok" ? `A build on this track usually takes about ${formatMs(e.medianMs)} (median of ${e.runs} past builds).` : "Not enough past builds to estimate how long this takes.";
}

const WAIT: Partial<Record<StepKind, (s: TimelineStep) => string>> = {
  start: () => "Waiting for the factory worker to start",
  preflight: () => "Checking it has everything it needs",
  build: (s) => (s.round && s.round > 0 ? `Fixing the problems the checks found (${s.label.toLowerCase()})` : "Writing the site"),
  qa: () => "Checking quality: the automatic checks and the design review",
};

const WAITING_ON: Partial<Record<StepKind, string>> = {
  start: "GitHub to start the factory worker",
  preflight: "the readiness check",
  build: "the site builder",
  qa: "the quality checks and the design reviewer",
};

/** The one sentence a person watching needs: what it is doing right now, and for how long. */
export function currentWait(t: Timeline, now: number): string | null {
  const s = t.current;
  if (!s) return t.outcome === "running" ? "Moving to the next step" : null;
  const f = WAIT[s.kind];
  const what = f ? f(s) : s.label;
  return s.startedAt ? `${what} (${formatMs(now - ms(s.startedAt))})` : what;
}

export const QA_STALL_MS = 5 * 60_000;

/** Past 2x the usual time for this step (or 5 minutes for quality checks), say so and name what it waits on. */
export function stallNote(t: Timeline, now: number, stepMedianMs: Partial<Record<"build" | "qa", number | null>>): string | null {
  const s = t.current;
  if (!s || !s.startedAt) return null;
  const elapsed = now - ms(s.startedAt);
  const med = s.kind === "build" || s.kind === "qa" ? (stepMedianMs[s.kind] ?? null) : null;
  const limit = med ? 2 * med : s.kind === "qa" ? QA_STALL_MS : null;
  if (limit === null || elapsed <= limit) return null;
  const usual = med ? `; it usually takes about ${formatMs(med)}` : "";
  return `Taking longer than usual: this step has run for ${formatMs(elapsed)}${usual}. It is waiting on ${WAITING_ON[s.kind] ?? "the worker"}.`;
}

/** Per-step medians from past runs' agent.complete rows ({role, durationMs}); each needs at least 3 samples. */
export function stepMedians(rows: { role?: unknown; durationMs?: unknown; payload?: Record<string, unknown> | null }[]): { build: number | null; qa: number | null } {
  const by: Record<string, number[]> = { build: [], qa: [] };
  for (const r of rows) {
    const role = r.role ?? r.payload?.role;
    const d = num(r.durationMs ?? r.payload?.durationMs);
    if (d === null) continue;
    if (role === BUILDER) by.build!.push(d);
    else if (role === QA) by.qa!.push(d);
  }
  const m = (xs: number[]) => (xs.length >= MIN_PAST_RUNS ? median(xs) : null);
  return { build: m(by.build!), qa: m(by.qa!) };
}

/** A compact line for list rows: "Quality checks on revision 2", "Stopped at quality checks". */
export function progressHint(t: Timeline): string | null {
  if (t.outcome === "running" || t.outcome === "waiting") {
    if (!t.current) return "Moving to the next step";
    const c = t.current;
    if (c.kind === "qa" && t.maxRounds !== null && c.round !== null) return `Quality checks, round ${c.round + 1} of ${t.maxRounds + 1}`;
    return c.label;
  }
  if (t.outcome === "gate") return "Ready for launch approval";
  if (t.stopped) return `Stopped at ${STOP_NAME[t.stoppedIn ?? ""] ?? t.stopped.label.toLowerCase()}`;
  return null;
}

const STOP_NAME: Record<string, string> = { preflight: "the readiness check", build: "writing the site", qa: "quality checks" };

/** For list rows without audit rows: where a stopped build stopped, from its job result alone. */
export function stoppedAtFromJob(j: Pick<JobRow, "result" | "status" | "kind">): string | null {
  if (j.status !== "failed" || (j.kind !== "build_plan" && j.kind !== "resume")) return null;
  const s = typeof j.result?.status === "string" ? (j.result.status as string) : null;
  const stage = s ? STAGE_OF_STATUS[s] : undefined;
  return stage ? `Stopped at ${STOP_NAME[stage]}` : null;
}
