/**
 * The six-step path (Cockpit v2, build prompt §5): Request, Proposal, Details needed, Building, Ready for approval, Live.
 * Derived from the plan, its details and its jobs, never from the 11-stage slug alone. One function feeds Home,
 * Projects, the project page's progress strip and its single primary button, and Notifications.
 *
 * Honest by construction: every state points at a real row; nothing is "done" unless a row says so. Two things the
 * design shows have no source yet (BLOCKED-ON-NICK.md, 2026-10-14): a recorded site approval ("Approved, waiting for
 * launch"), so callers pass `siteApprovedAt: null` until one exists; and fixed "usually" times, which come only from
 * past runs (`estimate()`) passed in by the caller.
 *
 * Copy is the design's (docs/design/cockpit-v2/Cockpit.dc.html: stripLines, pjNext, the client "next" strings), with its
 * sample figures ("2 of 7 supplied", "the logo and 2 pictures") replaced by the real counts and names.
 */
import { isActive, isStaleQueued, isStaleRunning, type JobRow } from "../jobsClient";
import { asStopped, detectNeeds, diagnoseJob, unansweredNeeds, type Diagnosis, type Need } from "./recovery";
import { STAGES } from "../stages";
import { shortDate, type PlanRow, type ProjectRow, type Role } from "./model";
import type { PlanInputRow } from "./inputs";

export const STEP_NAMES = ["Request", "Proposal", "Details needed", "Building", "Ready for approval", "Live"] as const;
export type Step = 0 | 1 | 2 | 3 | 4 | 5;
export type PathTone = "need" | "run" | "stop" | "done" | "wait";
export type PathState = "request" | "proposal" | "needs" | "building" | "stopped" | "ready" | "approved" | "live";

export interface NextAction {
  label: string;
  href?: string;
  /** For actions that are not a link (only "record-live" today; it records a date and never publishes). */
  action?: "record-live";
}

export interface PathResult {
  step: Step;
  state: PathState;
  tone: PathTone;
  /** "you", the deciding owner's name, "the factory", "Huraira", "a person launching it" or "nobody". */
  waitingOn: string;
  /** Where it stands, one sentence (the current cell of the strip). */
  sentence: string;
  /** "The one thing to do next", in words. */
  nextLine: string;
  nextAction: NextAction;
  /** Short line for lists (Home, Projects). */
  clientNext: string;
  /** The chip word for lists: "Waiting on Nick", "Running", "Stopped", "Done". */
  chipWord: string;
  /** Details the site still needs, by name (empty when nothing is known to be missing). */
  missing: Need[];
  supplied: number;
  skipped: number;
  /** The newest build of this plan that reached the worker, if any. */
  build: JobRow | null;
  diagnosis: Diagnosis | null;
}

export interface PathInput {
  /** The newest plan for this client (any status); null before the factory has written one. */
  plan: PlanRow | null;
  /** The intake job that started this client; used only while there is no plan yet. */
  intake?: JobRow | null;
  /** Jobs the viewer can read (owner/admin; RLS gives PMs none). */
  jobs: JobRow[];
  /** Current plan_inputs rows for the plan (newest per key). */
  inputs?: PlanInputRow[];
  /** The client's project, matched by the caller (client name), for the Live stage. */
  project?: Pick<ProjectRow, "stage"> | null;
  /** No source yet: a recorded site approval. Pass null until the approval record exists (BLOCKED-ON-NICK.md). */
  siteApprovedAt?: string | null;
  viewer: { role: Role | null; name?: string | null };
  /** The owner who decides proposals, site approval and money, by first name (e.g. "Nick"). */
  decider: string;
  now?: number;
}

const BUILD_KINDS = new Set(["build_plan", "resume"]);
const PROPOSAL_KINDS = new Set(["replan", "direction"]);
const LIVE_FROM = STAGES.indexOf("8_launch");
const LOGO: Need = { key: "asset.logo", label: "Logo", hint: "SVG, PNG or WebP, up to 512 KB.", multiline: false, why: "For the top of every page.", kind: "file" };

export const KIND_OF_SITE: Record<string, string> = { A: "Fast local site", B: "Showcase site with motion" };

const planIdOf = (j: JobRow): string | undefined => (j.params?.planId ?? j.result?.planId) as string | undefined;

/** Every build-type job of this plan (a resume belongs to the plan of the run it reopens). Cancelled and archived never. */
export function buildsOf(planId: string, jobs: JobRow[]): JobRow[] {
  const own = jobs.filter((j) => BUILD_KINDS.has(j.kind) && j.status !== "cancelled" && !j.archived_at);
  const byRun = new Map(own.filter((j) => j.kind === "build_plan").map((j) => [j.result?.workflowRunId, planIdOf(j)]));
  return own.filter((j) => (planIdOf(j) ?? byRun.get(j.params?.workflowRunId)) === planId);
}

/** The newest build of this plan, queued ones included (a build just requested is "Building"). */
export function latestBuild(planId: string, jobs: JobRow[]): JobRow | null {
  return [...buildsOf(planId, jobs)].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

/** What the site is known to need: the logo unless the brief has one, the proposal's open questions, and anything the
 *  last build's readiness check named. Nothing else is assumed to be required. */
export function knownNeeds(plan: PlanRow, build: JobRow | null): Need[] {
  const out = new Map<string, Need>();
  const hasBriefLogo = !!(plan.plan.plan as unknown as { brief?: { logo?: unknown } }).brief?.logo;
  if (!hasBriefLogo) out.set(LOGO.key, LOGO);
  const questions = [...(plan.plan.plan.openQuestions ?? []), ...(plan.plan.direction?.openQuestions ?? [])];
  questions.forEach((q, i) => out.set(`q${i + 1}`, { key: `q${i + 1}`, label: q, hint: "", multiline: true, why: "An open question in the proposal.", kind: "answer" }));
  if (build && build.result?.status === "needs_input") for (const n of detectNeeds(build)) out.set(n.key, n);
  return [...out.values()];
}

/** "the logo, the business phone number and the answers to 2 questions" */
export function missingWords(missing: Need[]): string {
  const named = missing.filter((n) => n.kind !== "answer").map((n) => `the ${n.label.charAt(0).toLowerCase()}${n.label.slice(1)}`);
  const answers = missing.filter((n) => n.kind === "answer").length;
  if (answers) named.push(answers === 1 ? "the answer to 1 question" : `the answers to ${answers} questions`);
  if (named.length <= 1) return named[0] ?? "";
  return `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
}

const canSupply = (role: Role | null) => role === "owner" || role === "admin";

export function derivePath(input: PathInput): PathResult {
  const { plan, intake = null, jobs, inputs = [], project = null, siteApprovedAt = null, viewer, decider, now = Date.now() } = input;
  const ownerAsks = viewer.role === "owner" ? "you" : decider;
  const supplierAsks = canSupply(viewer.role) ? "you" : decider;
  const me = viewer.name ?? "you";
  const done = (r: Omit<PathResult, "chipWord" | "missing" | "supplied" | "skipped" | "build" | "diagnosis"> & Partial<PathResult>): PathResult => ({
    missing: [],
    supplied: 0,
    skipped: 0,
    build: null,
    diagnosis: null,
    ...r,
    chipWord: r.tone === "need" ? `Waiting on ${r.waitingOn === "you" ? me : r.waitingOn}` : r.tone === "run" ? "Running" : r.tone === "stop" ? "Stopped" : r.tone === "done" ? "Done" : "Waiting",
  });

  // 5 Live: an owner recorded it live (the project reached the launch stage; only that action sets it). Checked first:
  // it holds even when the viewer cannot read the proposal.
  const build = plan ? latestBuild(plan.id, jobs) : null;
  if (project && STAGES.indexOf(project.stage as (typeof STAGES)[number]) >= LIVE_FROM)
    return done({ step: 5, state: "live", tone: "done", waitingOn: "nobody", sentence: "Launched by a person, outside the Cockpit.", nextLine: "Nothing. The site is live.", nextAction: { label: "See activity", href: "/activity" }, clientNext: "Live", build });

  // 0 Request: nothing written yet.
  if (!plan) {
    if (intake && isActive(intake, now))
      return done({ step: 0, state: "request", tone: "run", waitingOn: "the factory", sentence: "The factory is reading the request.", nextLine: "Nothing. The factory is reading the request; we will tell you when the proposal is ready.", nextAction: { label: "See the request", href: `/activity/${intake.id}` }, clientNext: "Reading the request" });
    if (intake && (intake.status === "failed" || isStaleQueued(intake, now) || isStaleRunning(intake, now))) {
      const d = diagnoseJob(asStopped(intake, now));
      return done({ step: 0, state: "request", tone: "stop", waitingOn: d.actor === "huraira" ? "Huraira" : supplierAsks, sentence: `Stopped: ${d.headline}`, nextLine: d.savedText, nextAction: { label: "See the fix", href: `/activity/${intake.id}` }, clientNext: "Fix the stopped request", diagnosis: d });
    }
    return done({ step: 0, state: "request", tone: "need", waitingOn: supplierAsks, sentence: "Paste what the client asked for.", nextLine: "Send the request to the factory", nextAction: { label: "Open the request", href: "/projects/new" }, clientNext: "Send the request" });
  }

  const planHref = `/decisions/plans/${plan.id}`;

  // 1 Proposal: waiting for a decision, or a new one is being written.
  const writing = jobs.find((j) => PROPOSAL_KINDS.has(j.kind) && planIdOf(j) === plan.id && isActive(j, now));
  if (writing)
    return done({ step: 1, state: "proposal", tone: "run", waitingOn: "the factory", sentence: "The factory is writing a new proposal.", nextLine: "Nothing. The factory is writing the proposal; we will tell you when it is ready.", nextAction: { label: "See the request", href: `/activity/${writing.id}` }, clientNext: "Writing the proposal" });
  if (plan.status !== "approved")
    return done({
      step: 1,
      state: "proposal",
      tone: "need",
      waitingOn: ownerAsks,
      sentence: plan.status === "pending" ? "The proposal is ready for you to read." : "The proposal was not approved.",
      nextLine: "Read the proposal and choose the kind of site",
      nextAction: { label: "Review the proposal", href: planHref },
      clientNext: "Approve the proposal",
    });

  // Approved from here on. What is known to be missing, against the details given.
  const needs = knownNeeds(plan, build);
  const missing = unansweredNeeds(needs, inputs);
  const tracked = new Set(needs.map((n) => n.key));
  const supplied = inputs.filter((i) => tracked.has(i.key) && !i.waived && (i.value ?? "").trim() !== "").length;
  const skipped = inputs.filter((i) => tracked.has(i.key) && i.waived).length;
  const base = { missing, supplied, skipped, build };

  // 2 Details needed: approved and never built, or the readiness check stopped for details nobody has given yet.
  const stoppedForDetails = !!build && build.result?.status === "needs_input" && missing.length > 0 && !isActive(build, now);
  if (!build || stoppedForDetails) {
    const names = missingWords(missing);
    return done({
      ...base,
      step: 2,
      state: "needs",
      tone: "need",
      waitingOn: supplierAsks,
      sentence: missing.length ? `${supplied} of ${needs.length} supplied. Waiting for ${names}.` : "Everything the proposal asked for is in.",
      nextLine: missing.length ? `Add ${names}, then start the build` : "Start the build",
      nextAction: { label: missing.length ? "Add the missing details" : "Start the build", href: planHref },
      clientNext: missing.length ? `Add ${names}` : "Start the build",
    });
  }

  // 3 Building: running now.
  if (isActive(build, now))
    return done({ ...base, step: 3, state: "building", tone: "run", waitingOn: "the factory", sentence: "Building and checking now.", nextLine: "Nothing. The factory is building; we will tell you when it needs you.", nextAction: { label: "Watch the build", href: `/activity/${build.id}` }, clientNext: "Building now" });

  // 4 Ready for approval: every check passed. (Approved-and-waiting-for-launch needs a recorded approval: none yet.)
  if (build.status === "succeeded" && build.result?.status === "awaiting_launch_approval") {
    if (siteApprovedAt)
      return done({ ...base, step: 4, state: "approved", tone: "done", waitingOn: "a person launching it", sentence: "Approved. Waiting for a person to launch it.", nextLine: "When a person has launched it, record that it is live", nextAction: { label: "Record that it is live", action: "record-live" }, clientNext: "Waiting for launch, done outside" });
    return done({ ...base, step: 4, state: "ready", tone: "need", waitingOn: ownerAsks, sentence: "Every check passed. Your call.", nextLine: "Look at the finished site and approve it, or ask for changes", nextAction: { label: "Review the finished site", href: `/activity/${build.id}` }, clientNext: "Approve the finished site" });
  }

  // 3 Building, stopped: anything else a finished or stale build reports.
  const d = diagnoseJob(asStopped(build, now), buildsOf(plan.id, jobs), { planId: plan.id });
  const nextLine = d.cause === "info" && d.needs.length ? `Add ${missingWords(d.needs)}, or build without ${d.needs.length === 1 ? "it" : "them"}` : fixLabel(d, viewer.role, decider);
  // Credit and setup are Huraira's to fix (design, stop case 4), whoever is looking.
  // A spending limit is the owner's money decision, never Huraira's.
  const huraira = !isSpendStop(d) && (d.actor === "huraira" || d.cause === "money" || d.cause === "setup");
  return done({ ...base, step: 3, state: "stopped", tone: "stop", waitingOn: huraira ? "Huraira" : isSpendStop(d) ? ownerAsks : supplierAsks, sentence: `Stopped: ${d.headline}`, nextLine, nextAction: { label: "See the fix", href: `/activity/${build.id}` }, clientNext: "Fix the stopped build", diagnosis: d });
}

const isSpendStop = (d: Diagnosis) => d.cause === "setup" && /spending limit/i.test(d.headline);

/** The one fix for a stop, in the design's words (build prompt §6.8, the 8 cases). Money is the owner's call. */
export function fixLabel(d: Diagnosis, role: Role | null, decider: string): string {
  if (d.cause === "info") return "Save the details and continue";
  if (d.cause === "money") return "Try again once it is set up";
  if (isSpendStop(d)) return role === "owner" ? "Raise the limit for this build" : `Ask ${decider} to raise the limit for this build`;
  if (d.cause === "setup") return "Try again once it is set up";
  if (d.cause === "temporary") return "Check again without changes";
  if (d.cause === "fixable") return "Fix it and continue";
  if (d.saved === "none") return "Write the site again from the proposal";
  return "Continue from where it stopped";
}

/** The six cells of the progress strip: what happened (done), where it stands (current), "Not yet." (later). `usual`
 *  times are design words only where they are not figures; minutes come from past runs, passed in by the caller. */
export function stripSteps(p: PathResult, plan: PlanRow | null, opts: { receivedAt?: string | null; proposalUsual?: string; buildUsual?: string } = {}): { line: string; usual: string }[] {
  const kind = plan?.build_track ? KIND_OF_SITE[plan.build_track] : null;
  const cycles = typeof p.build?.result?.cycles === "number" ? (p.build.result.cycles as number) : null;
  const rounds = cycles === null ? null : Math.max(0, cycles - 1);
  const doneLines = [
    opts.receivedAt ? `Received ${shortDate(opts.receivedAt)}.` : "Received.",
    kind ? `Approved as a ${kind}.` : "Approved.",
    `${p.supplied} supplied, ${p.skipped} left out on purpose.`,
    rounds ? `Every check passed after ${rounds} ${rounds === 1 ? "round" : "rounds"} of fixes.` : "Every check passed.",
    p.state === "approved" ? "Approved. Waiting for a person to launch it." : "Every check passed.",
    "Launched by a person, outside the Cockpit.",
  ];
  const usual = ["", opts.proposalUsual ?? "", "Depends on the client", opts.buildUsual ?? "", "As long as you need", "Recorded here"];
  return STEP_NAMES.map((_, i) => ({
    line: i < p.step || (i === p.step && p.tone === "done") ? doneLines[i]! : i === p.step ? p.sentence : "Not yet.",
    usual: usual[i]!,
  }));
}
