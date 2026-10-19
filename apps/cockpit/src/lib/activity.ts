/**
 * The Activity room (Cockpit v2 phase 14): everything the factory and the team did, newest first. Person events come
 * from the one phrase table (lib/phrases.ts); factory events come from what the rows record and nothing else: a
 * proposal written (intake/replan job finished with a proposal), a build finished with every check passed, a build
 * stopped (diagnoseJob says why), and a round of fixes started (workflow.return_to_builder in the run's audit trail).
 * Owners and admins only: audit_log and jobs are owner/admin under RLS.
 */
import { supabase } from "../supabaseClient";
import type { JobRow } from "../jobsClient";
import { planIdOfJob } from "./attention";
import { clientNameOf } from "./clients";
import type { PlanRow } from "./model";
import { KIND_OF_SITE } from "./path";
import { personLines, roundActor, whoOf, type ActivityType, type AuditEvent, type Glyph } from "./phrases";
import { diagnoseJob } from "./recovery";
import { issueLabel } from "./timeline";
import { stageLabel } from "../stages";

export type FactoryGlyph = "finished" | "stopped" | "round" | "proposal";

export interface ActivityLine {
  key: string;
  at: string;
  /** A profile id, or FACTORY for the factory itself. */
  actor: string;
  /** What happened, as a sentence without the subject, starting with a capital and ending with a full stop. */
  text: string;
  type: ActivityType;
  glyph: Glyph | FactoryGlyph;
  /** The client's name, or null when the event is not about one client (a team change). */
  client: string | null;
  /** The build or request the line is about, so the row can open its page (the only way back to an archived build). */
  jobId: string | null;
}

export const FACTORY = "factory";

/** A round of fixes, linked to its run; the run is linked to a job by job.run (task_id = job id). */
export interface RoundEvent {
  occurred_at: string;
  run_id: string | null;
  task_id: string | null;
  action: string;
}

/** The rows that say a round of fixes started, and the job.run links that tie a run to its jobs. Small fields only. */
export async function fetchRoundEvents(limit = 400): Promise<RoundEvent[]> {
  const res = await supabase.from("audit_log").select("action,occurred_at,run_id,task_id").in("action", ["workflow.return_to_builder", "job.run"]).order("occurred_at", { ascending: false }).limit(limit);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as RoundEvent[];
}

const BUILD_KINDS = new Set(["build_plan", "resume"]);
const sentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?]$/.test(s) ? "" : "."}`;

/** What the factory itself did, from the job rows and the round events. */
export function factoryLines(jobs: JobRow[], plans: PlanRow[], rounds: RoundEvent[]): ActivityLine[] {
  const planById = new Map(plans.map((p) => [p.id, p]));
  const clientOfPlan = (id: string | null | undefined) => (id && planById.get(id) ? clientNameOf(planById.get(id)!) : null);
  const clientOfJob = (j: JobRow) => clientOfPlan(planIdOfJob(j, jobs));
  const out: ActivityLine[] = [];

  for (const j of jobs) {
    if (!j.finished_at) continue;
    if ((j.kind === "intake" || j.kind === "replan") && j.status === "succeeded") {
      const plan = planById.get(j.result?.planId as string);
      if (!plan) continue;
      const track = plan.plan.direction?.recommendation?.track;
      const kind = track ? KIND_OF_SITE[track] : null;
      out.push({ key: `job:${j.id}`, at: j.finished_at, actor: FACTORY, text: `Wrote proposal ${plan.revision}.${kind ? ` Recommends a ${kind}.` : ""}`, type: "build", glyph: "proposal", client: clientNameOf(plan), jobId: j.id });
    } else if (BUILD_KINDS.has(j.kind) && (j.status === "succeeded" || j.status === "failed")) {
      const passed = j.status === "succeeded" && j.result?.status === "awaiting_launch_approval";
      out.push(
        passed
          ? { key: `job:${j.id}`, at: j.finished_at, actor: FACTORY, text: "Finished: every check passed. Ready for approval.", type: "build", glyph: "finished", client: clientOfJob(j), jobId: j.id }
          : { key: `job:${j.id}`, at: j.finished_at, actor: FACTORY, text: sentence(`Stopped: ${diagnoseJob(j, jobs).headline}`), type: "stop", glyph: "stopped", client: clientOfJob(j), jobId: j.id },
      );
    }
  }

  // Each run's jobs, so a round belongs to the newest job that started before it.
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const jobsOfRun = new Map<string, JobRow[]>();
  const link = (runId: string, j: JobRow) => {
    const list = jobsOfRun.get(runId) ?? [];
    if (!list.includes(j)) jobsOfRun.set(runId, [...list, j]);
  };
  for (const r of rounds) if (r.action === "job.run" && r.run_id && r.task_id && jobById.has(r.task_id)) link(r.run_id, jobById.get(r.task_id)!);
  for (const j of jobs) if (typeof j.result?.workflowRunId === "string") link(j.result.workflowRunId, j);
  for (const r of rounds) {
    if (r.action !== "workflow.return_to_builder" || !r.run_id) continue;
    const owner = (jobsOfRun.get(r.run_id) ?? []).filter((j) => j.created_at <= r.occurred_at).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    out.push({ key: `round:${r.run_id}:${r.occurred_at}`, at: r.occurred_at, actor: FACTORY, text: "Started a round of fixes on the problems the checks found.", type: "build", glyph: "round", client: owner ? clientOfJob(owner) : null, jobId: owner?.id ?? null });
  }
  return out;
}

/** One row of correction_rounds: each time a check or a person sent work back to be fixed (owner/admin, or a PM's own
 *  clients, under RLS; the Activity room is owners and admins only). */
export interface CorrectionRound {
  id: string;
  round_number: number;
  stage: string;
  flagged_by: string;
  issue: string;
  fixed_by: string | null;
  created_at: string;
  projects: { name: string; clients: { name: string } | null } | null;
}

export async function fetchCorrectionRounds(limit = 100): Promise<CorrectionRound[]> {
  const res = await supabase
    .from("correction_rounds")
    .select("id,round_number,stage,flagged_by,issue,fixed_by,created_at,projects(name,clients(name))")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as unknown as CorrectionRound[];
}

/** Each logged round of fixes as an Activity line (filter "Fix rounds"): the round, what was wrong in plain words, who
 *  found it and whether it was fixed. */
export function roundLines(rows: CorrectionRound[]): ActivityLine[] {
  return rows.map((r) => {
    const found = roundActor(r.flagged_by);
    const fixed = roundActor(r.fixed_by);
    const who = `${found ? `${found.charAt(0).toUpperCase()}${found.slice(1)} found it` : "Found by a check"}; ${r.fixed_by ? (fixed ? `${fixed} fixed it` : "it was fixed") : "not marked fixed yet"}.`;
    return {
      key: `fix:${r.id}`,
      at: r.created_at,
      actor: FACTORY,
      text: `Round ${r.round_number} of fixes, ${stageLabel(r.stage).toLowerCase()}: ${sentence(issueLabel(r.issue))} ${who}`,
      type: "round",
      glyph: "round",
      client: r.projects?.clients?.name ?? r.projects?.name ?? null,
      jobId: null,
    };
  });
}

/** Person events as Activity lines, with the client named from the proposal or the job they are about. */
export function teamLines(events: AuditEvent[], people: Record<string, string>, jobs: JobRow[], plans: PlanRow[]): ActivityLine[] {
  const planById = new Map(plans.map((p) => [p.id, p]));
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  return personLines(events, people).map((l) => {
    const job = l.jobId ? jobById.get(l.jobId) : undefined;
    const planId = l.planId ?? (job ? planIdOfJob(job, jobs) : null);
    const plan = planId ? planById.get(planId) : undefined;
    return { key: l.key, at: l.at, actor: l.actor, text: sentence(l.verb), type: l.type, glyph: l.glyph, client: plan ? clientNameOf(plan) : null, jobId: job ? job.id : null };
  });
}

export interface ActivityFilter {
  client: string;
  person: string;
  type: "all" | Exclude<ActivityType, "other">;
}
export const ALL_ACTIVITY: ActivityFilter = { client: "all", person: "all", type: "all" };

export function matches(l: ActivityLine, f: ActivityFilter): boolean {
  return (f.type === "all" || l.type === f.type) && (f.client === "all" || l.client === f.client) && (f.person === "all" || l.actor === f.person);
}

export interface ActivityDay {
  label: string;
  items: ActivityLine[];
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** Newest first, grouped by day: Today, Yesterday, then the date. */
export function byDay(lines: ActivityLine[], now = new Date()): ActivityDay[] {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const out: ActivityDay[] = [];
  for (const l of [...lines].sort((a, b) => b.at.localeCompare(a.at))) {
    const d = new Date(l.at);
    const k = dayKey(d);
    const label = k === today ? "Today" : k === yesterday ? "Yesterday" : dayFmt.format(d);
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(l);
    else out.push({ label, items: [l] });
  }
  return out;
}

/** Who did it, as the row says it. */
export const actorName = (actor: string, people: Record<string, string>, me: string | null) => (actor === FACTORY ? "The factory" : whoOf(actor, people, me));
