/**
 * "Is everything OK, and what needs me?" (Blueprint §9, Step 4C Home). A pure function over rows the
 * Cockpit already reads, so it is unit-tested without a database. It never invents state: every item
 * points at a real row, and an item disappears only when the rows say it was dealt with.
 */
import { isActive, isStaleQueued, isStaleRunning, type JobRow } from "../jobsClient";
import { KIND_LABEL, LEAD_LABEL, planName, shortDate, dateTime, type AccountRequestRow, type PlanRow } from "./model";
import { asStopped, diagnoseJob } from "./recovery";

export type AttentionKind = "plan" | "account" | "launch" | "ready" | "failed" | "stuck";

export interface AttentionItem {
  key: string;
  kind: AttentionKind;
  tone: "caution" | "stop";
  /** A decision only a person can make (counted on the Decisions badge). */
  isDecision: boolean;
  label: string;
  title: string;
  why: string;
  href: string;
  at: string;
}

const BUILD_KINDS = new Set(["build_plan", "resume"]);
const RECENT_FAILURE_MS = 72 * 60 * 60 * 1000;

/** Which plan a build-type job belongs to: build_plan names it; resume inherits it from the run it resumes. */
export function planIdOfJob(job: JobRow, jobs: JobRow[]): string | null {
  const direct = (job.params?.planId ?? job.result?.planId) as string | undefined;
  if (direct) return direct;
  if (job.kind === "resume") {
    const runId = job.params?.workflowRunId;
    const origin = jobs.find((j) => j.kind === "build_plan" && j.result?.workflowRunId === runId);
    return (origin?.params?.planId as string | undefined) ?? null;
  }
  return null;
}

/** The newest build-type job per plan that actually reached the worker (queued/cancelled don't count). */
export function latestBuildByPlan(jobs: JobRow[]): Map<string, JobRow> {
  const out = new Map<string, JobRow>();
  const sorted = [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const j of sorted) {
    if (!BUILD_KINDS.has(j.kind) || j.status === "queued" || j.status === "cancelled") continue;
    const planId = planIdOfJob(j, jobs);
    if (planId && !out.has(planId)) out.set(planId, j);
  }
  return out;
}

export interface AttentionInput {
  plans: PlanRow[];
  jobs: JobRow[];
  accounts: AccountRequestRow[];
  myId: string | null;
  /** owner/admin: may decide plans and accounts and see jobs (RLS agrees). */
  canDecide: boolean;
  now?: number;
}

export function buildAttention({ plans, jobs, accounts, myId, canDecide, now = Date.now() }: AttentionInput): AttentionItem[] {
  if (!canDecide) return [];
  // An archived run was dealt with by a person (migration 0015); it never asks for attention again.
  jobs = jobs.filter((j) => !j.archived_at);
  const items: AttentionItem[] = [];
  const planById = new Map(plans.map((p) => [p.id, p]));
  const latest = latestBuildByPlan(jobs);

  for (const p of plans.filter((x) => x.status === "pending")) {
    const rec = p.plan.direction?.recommendation;
    const lead = LEAD_LABEL[p.plan.plan.intake?.leadType] ?? "Request";
    const recText = rec?.track ? `Track ${rec.track} recommended (${Math.round(rec.confidence * 100)}% sure)` : "No track recommended, you choose";
    items.push({
      key: `plan:${p.id}`,
      kind: "plan",
      tone: "caution",
      isDecision: true,
      label: "Your decision",
      title: `Approve or reject the ${planName(p)} plan`,
      why: `${lead}, ${p.entity_slug}. ${recText}. Written ${dateTime(p.created_at)}.`,
      href: `/decisions/plans/${p.id}`,
      at: p.created_at,
    });
  }

  for (const a of accounts.filter((x) => x.status === "pending" && x.user_id !== myId)) {
    items.push({
      key: `account:${a.user_id}`,
      kind: "account",
      tone: "caution",
      isDecision: true,
      label: "Your decision",
      title: `Review the account request from ${a.full_name ?? a.email}`,
      why: `${a.email} asked for access on ${dateTime(a.requested_at)}.`,
      href: "/decisions/accounts",
      at: a.requested_at,
    });
  }

  for (const [planId, j] of latest) {
    const name = planName(planById.get(planId));
    if (j.status === "succeeded" && j.result?.status === "awaiting_launch_approval") {
      items.push({
        key: `launch:${planId}`,
        kind: "launch",
        tone: "caution",
        isDecision: true,
        label: "Your decision",
        title: `Decide on launching the ${name} build`,
        why: `Passed every check on ${dateTime(j.finished_at ?? j.created_at)}. Nothing is published until you launch it outside the Cockpit.`,
        href: `/activity/${j.id}`,
        at: j.finished_at ?? j.created_at,
      });
    } else if (j.status === "failed" || isStaleRunning(j, now)) {
      const dg = diagnoseJob(asStopped(j, now), jobs.filter((x) => planIdOfJob(x, jobs) === planId), { planId });
      items.push({
        key: `failed:${j.id}`,
        kind: "failed",
        tone: "stop",
        isDecision: false,
        label: dg.cause === "info" ? "Needs your input" : dg.actor === "huraira" ? "With the technical team" : "Needs fixing",
        title: dg.cause === "info" ? `The ${name} build needs a few details from you` : `The ${name} build stopped: ${dg.headline}`,
        why: `${KIND_LABEL[j.kind]}, ${dateTime(j.created_at)}. ${dg.carryOn === "continue" ? "Open it: one button carries on from the saved step." : "Open it to see what to do."}`,
        href: `/activity/${j.id}`,
        at: j.created_at,
      });
    }
  }

  for (const p of plans.filter((x) => x.status === "approved" && x.build_track)) {
    const everBuilt = jobs.some((j) => BUILD_KINDS.has(j.kind) && j.status !== "cancelled" && planIdOfJob(j, jobs) === p.id);
    if (!everBuilt) {
      items.push({
        key: `ready:${p.id}`,
        kind: "ready",
        tone: "caution",
        isDecision: false,
        label: "Ready to build",
        title: `Start the build for ${planName(p)}`,
        why: `Approved as Track ${p.build_track}${p.decided_at ? ` on ${shortDate(p.decided_at)}` : ""}. Building and checking takes a few minutes; nothing is published.`,
        href: `/decisions/plans/${p.id}`,
        at: p.decided_at ?? p.created_at,
      });
    }
  }

  for (const j of jobs) {
    if (BUILD_KINDS.has(j.kind) || j.status !== "failed") continue;
    if (now - new Date(j.created_at).getTime() > RECENT_FAILURE_MS) continue;
    items.push({
      key: `failed:${j.id}`,
      kind: "failed",
      tone: "stop",
      isDecision: false,
      label: "Needs fixing",
      title: `${KIND_LABEL[j.kind]} failed: ${diagnoseJob(j).headline}`,
      why: `${dateTime(j.created_at)}. Open it to see what to do.`,
      href: `/activity/${j.id}`,
      at: j.created_at,
    });
  }

  const stuck = jobs.filter((j) => isStaleQueued(j, now));
  if (stuck.length > 0) {
    const oldest = stuck.reduce((a, b) => (a.created_at < b.created_at ? a : b));
    const them = stuck.length === 1 ? "it" : "them";
    items.push({
      key: "stuck",
      kind: "stuck",
      tone: "stop",
      isDecision: false,
      label: "Needs tidying",
      title: stuck.length === 1 ? "1 request never started" : `${stuck.length} requests never started`,
      why: `Created ${shortDate(oldest.created_at)}, never reached GitHub. Start ${them} again or close ${them}.`,
      href: stuck.length === 1 ? `/activity/${stuck[0]!.id}` : "/activity?show=stuck",
      at: oldest.created_at,
    });
  }

  return items.sort((a, b) => a.at.localeCompare(b.at));
}

/** The Home status line: one sentence that answers "is everything OK?". */
export function statusLine(items: AttentionItem[]): string {
  const decisions = items.filter((i) => i.isDecision).length;
  const problems = items.filter((i) => i.tone === "stop").length;
  const ready = items.filter((i) => i.kind === "ready").length;
  const d = decisions === 1 ? "1 decision is waiting for you" : `${decisions} decisions are waiting for you`;
  const p = problems === 1 ? "1 thing needs fixing" : `${problems} things need fixing`;
  if (decisions && problems) return `${d}, and ${p}.`;
  if (decisions) return `${d}.`;
  if (problems) return `${p}.`;
  if (ready) return ready === 1 ? "1 build is ready to start." : `${ready} builds are ready to start.`;
  return "Nothing needs you right now.";
}

export function runningJobs(jobs: JobRow[], now = Date.now()): JobRow[] {
  return jobs.filter((j) => isActive(j, now));
}

export function recentlyFinished(jobs: JobRow[], limit = 4): JobRow[] {
  return jobs
    .filter((j) => !j.archived_at && (j.status === "succeeded" || j.status === "failed" || j.status === "cancelled"))
    .sort((a, b) => (b.finished_at ?? b.created_at).localeCompare(a.finished_at ?? a.created_at))
    .slice(0, limit);
}
