/**
 * "What needs you" (Cockpit v2 Home) and the Notifications inbox: one list, from one source. A pure function over rows
 * the Cockpit already reads, so it is unit-tested without a database. Client items come from each client's six-step
 * path (lib/clients.ts, lib/path.ts); the rest are account requests, requests that never started, and other stopped
 * work. It never invents state: every item points at a real row and disappears only when the rows say it was dealt
 * with. Order: stopped first, then approvals, then missing details; oldest first within each.
 */
import { isActive, isStaleQueued, isStaleRunning, type JobRow } from "../jobsClient";
import { KIND_LABEL, shortDate, dateTime, type AccountRequestRow } from "./model";
import { asStopped, diagnoseJob } from "./recovery";
import type { ClientRow } from "./clients";
import { KIND_OF_SITE } from "./path";

export type AttentionKind = "plan" | "account" | "launch" | "ready" | "details" | "failed" | "stuck";
export type AttentionGroup = "stopped" | "approval" | "details";

export interface AttentionItem {
  key: string;
  kind: AttentionKind;
  group: AttentionGroup;
  tone: "caution" | "stop";
  /** A decision only a person can make. */
  isDecision: boolean;
  /** Only the owner may act (proposals, the finished site, money); everyone else sees "<owner> decides this". */
  ownerOnly: boolean;
  /** The chip word: "Stopped", "Your approval", "Waiting for the logo". */
  label: string;
  /** The client it is about; empty for account requests and factory housekeeping. */
  client: string;
  title: string;
  why: string;
  /** The one button. */
  cta: string;
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
  clients: ClientRow[];
  jobs: JobRow[];
  accounts: AccountRequestRow[];
  myId: string | null;
  /** owner/admin: may decide plans and accounts and see jobs (RLS agrees). */
  canDecide: boolean;
  now?: number;
}

const GROUP_ORDER: Record<AttentionGroup, number> = { stopped: 0, approval: 1, details: 2 };

export function buildAttention({ clients, jobs, accounts, myId, canDecide, now = Date.now() }: AttentionInput): AttentionItem[] {
  if (!canDecide) return [];
  // An archived run was dealt with by a person (migration 0015); it never asks for attention again.
  jobs = jobs.filter((j) => !j.archived_at);
  const items: AttentionItem[] = [];

  for (const c of clients) {
    const p = c.path;
    if (!p || !c.plan) continue;
    const at = p.build?.finished_at ?? p.build?.created_at ?? c.plan.decided_at ?? c.plan.created_at;
    if (p.state === "stopped" || (p.state === "request" && p.tone === "stop")) {
      items.push({ key: `failed:${p.build?.id ?? c.key}`, kind: "failed", group: "stopped", tone: "stop", isDecision: false, ownerOnly: p.nextLine.startsWith("Raise the limit"), label: "Stopped", client: c.name, title: `A build stopped: ${p.diagnosis?.headline ?? "it needs a look"}`, why: `${p.nextLine}.`, cta: "See the fix", href: p.nextAction.href ?? c.href, at });
    } else if (p.state === "proposal" && p.tone === "need") {
      const rec = c.plan.plan.direction?.recommendation?.track;
      const open = (c.plan.plan.plan.openQuestions?.length ?? 0) + (c.plan.plan.direction?.openQuestions?.length ?? 0);
      const why = [rec ? `Recommended: ${KIND_OF_SITE[rec] ?? "a kind of site"}.` : "No kind of site recommended; you choose.", open ? `${open} ${open === 1 ? "question is" : "questions are"} still open.` : null].filter(Boolean).join(" ");
      items.push({ key: `plan:${c.plan.id}`, kind: "plan", group: "approval", tone: "caution", isDecision: true, ownerOnly: true, label: "Your approval", client: c.name, title: "Approve the proposal", why, cta: "Review the proposal", href: p.nextAction.href ?? c.href, at: c.plan.created_at });
    } else if (p.state === "ready") {
      const ph = Array.isArray(p.build?.result?.placeholders) ? (p.build!.result!.placeholders as unknown[]).length : 0;
      const why = `Every check passed.${ph ? ` ${ph} placeholder ${ph === 1 ? "picture is" : "pictures are"} still on the site.` : ""}`;
      items.push({ key: `launch:${c.plan.id}`, kind: "launch", group: "approval", tone: "caution", isDecision: true, ownerOnly: true, label: "Your approval", client: c.name, title: "Approve the finished site", why, cta: "Review the site", href: p.nextAction.href ?? c.href, at });
    } else if (p.state === "needs") {
      const missing = p.missing.length > 0;
      items.push({
        key: `details:${c.plan.id}`,
        kind: missing ? "details" : "ready",
        group: "details",
        tone: "caution",
        isDecision: false,
        ownerOnly: false,
        label: missing ? `Waiting for ${p.missing[0]!.kind === "answer" ? "an answer" : `the ${p.missing[0]!.label.charAt(0).toLowerCase()}${p.missing[0]!.label.slice(1)}`}` : "Ready to build",
        client: c.name,
        title: missing ? p.clientNext : "Start the build",
        why: p.sentence,
        cta: missing ? "Add them" : "Start the build",
        href: p.nextAction.href ?? c.href,
        at,
      });
    }
  }

  for (const a of accounts.filter((x) => x.status === "pending" && x.user_id !== myId)) {
    items.push({ key: `account:${a.user_id}`, kind: "account", group: "approval", tone: "caution", isDecision: true, ownerOnly: false, label: "Your approval", client: "", title: `Let ${a.full_name ?? a.email} in`, why: `${a.email} asked for access on ${dateTime(a.requested_at)}.`, cta: "Review the request", href: "/team", at: a.requested_at });
  }

  // Builds of a proposal the viewer has no client row for (an old or superseded proposal), and other work that stopped.
  const known = new Set(clients.map((c) => c.plan?.id).filter(Boolean) as string[]);
  for (const [planId, j] of latestBuildByPlan(jobs)) {
    if (known.has(planId) || !(j.status === "failed" || isStaleRunning(j, now))) continue;
    const dg = diagnoseJob(asStopped(j, now), jobs.filter((x) => planIdOfJob(x, jobs) === planId), { planId });
    items.push({ key: `failed:${j.id}`, kind: "failed", group: "stopped", tone: "stop", isDecision: false, ownerOnly: false, label: "Stopped", client: "", title: `A build stopped: ${dg.headline}`, why: `${dateTime(j.created_at)}. Open it to see what to do.`, cta: "See the fix", href: `/activity/${j.id}`, at: j.created_at });
  }
  for (const j of jobs) {
    if (BUILD_KINDS.has(j.kind) || j.status !== "failed") continue;
    if (now - new Date(j.created_at).getTime() > RECENT_FAILURE_MS) continue;
    items.push({ key: `failed:${j.id}`, kind: "failed", group: "stopped", tone: "stop", isDecision: false, ownerOnly: false, label: "Stopped", client: "", title: `${KIND_LABEL[j.kind]} stopped: ${diagnoseJob(j).headline}`, why: `${dateTime(j.created_at)}. Open it to see what to do.`, cta: "See the fix", href: `/activity/${j.id}`, at: j.created_at });
  }

  const stuck = jobs.filter((j) => isStaleQueued(j, now));
  if (stuck.length > 0) {
    const oldest = stuck.reduce((a, b) => (a.created_at < b.created_at ? a : b));
    const them = stuck.length === 1 ? "it" : "them";
    items.push({
      key: "stuck",
      kind: "stuck",
      group: "stopped",
      tone: "stop",
      isDecision: false,
      ownerOnly: false,
      label: "Stopped",
      client: "",
      title: stuck.length === 1 ? "1 request never started" : `${stuck.length} requests never started`,
      why: `Sent ${shortDate(oldest.created_at)}, but it never started. Start ${them} again or close ${them}.`,
      cta: stuck.length === 1 ? "Open it" : "Open them",
      href: stuck.length === 1 ? `/activity/${stuck[0]!.id}` : "/activity?show=stuck",
      at: oldest.created_at,
    });
  }

  return items.sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || a.at.localeCompare(b.at));
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
