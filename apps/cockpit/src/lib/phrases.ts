/**
 * One phrase table for the audit trail (Cockpit v2): every person-made action said in plain words, never as its raw
 * slug. The project page's decisions timeline uses it now; the Activity room reuses it. An action this table does not
 * know is left out, rather than shown as a slug.
 *
 * Linking (checked against live rows, 2026-10-14): plan.decision and plan.input carry the proposal id in task_id;
 * job.requested carries the job id in task_id and the proposal id in payload.params.planId (or the run it reopens).
 */
import { supabase } from "../supabaseClient";
import { KIND_OF_SITE } from "./path";

export interface AuditEvent {
  id: string;
  occurred_at: string;
  actor: string;
  action: string;
  task_id: string | null;
  payload: Record<string, unknown> | null;
}

export const PERSON_ACTIONS = ["plan.decision", "plan.input", "job.requested", "job.archived", "job.cancelled"] as const;

export async function fetchPersonEvents(limit = 400): Promise<AuditEvent[]> {
  const res = await supabase.from("audit_log").select("id,occurred_at,actor,action,task_id,payload").in("action", [...PERSON_ACTIONS]).order("occurred_at", { ascending: false }).limit(limit);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as AuditEvent[];
}

/** First names by profile id (owner/admin can read profiles under RLS); used to say who did it. */
export async function fetchPeople(): Promise<Record<string, string>> {
  const res = await supabase.from("profiles").select("id,full_name");
  if (res.error || !res.data) return {};
  return Object.fromEntries((res.data as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name?.trim().split(/\s+/)[0] || "Someone"]));
}

const JOB_PHRASE: Record<string, string> = {
  intake: "sent the request to the factory",
  build_plan: "started a build",
  resume: "continued the build",
  replan: "asked for a new proposal",
  direction: "asked for the direction again",
  verify: "asked for the checks to run again",
  ask: "asked the factory a question",
};

export interface Phrase {
  key: string;
  text: string;
  at: string;
}

/** Plain sentences for a set of events, newest first. Details added together become one line. */
export function phrase(events: AuditEvent[], people: Record<string, string>, me: string | null): Phrase[] {
  const who = (id: string) => (id === me ? "You" : people[id] ?? "Someone");
  const out: Phrase[] = [];
  const inputs = new Map<string, { at: string; actor: string; given: number; left: number }>();
  for (const e of events) {
    const p = e.payload ?? {};
    if (e.action === "plan.decision") {
      const status = p.status as string | undefined;
      const kind = typeof p.buildTrack === "string" ? KIND_OF_SITE[p.buildTrack] : null;
      if (status === "approved") out.push({ key: e.id, at: e.occurred_at, text: `${who(e.actor)} approved the proposal${kind ? `: ${kind}` : ""}` });
      else if (status === "rejected") out.push({ key: e.id, at: e.occurred_at, text: `${who(e.actor)} asked for changes to the proposal` });
    } else if (e.action === "plan.input") {
      const k = `${e.actor}|${e.occurred_at}|${e.task_id}`;
      const g = inputs.get(k) ?? { at: e.occurred_at, actor: e.actor, given: 0, left: 0 };
      if (p.waived) g.left += 1;
      else g.given += 1;
      inputs.set(k, g);
    } else if (e.action === "job.requested") {
      const words = JOB_PHRASE[p.kind as string];
      if (words) out.push({ key: e.id, at: e.occurred_at, text: `${who(e.actor)} ${words}` });
    } else if (e.action === "job.archived") {
      out.push({ key: e.id, at: e.occurred_at, text: `${who(e.actor)} put a stopped build away` });
    } else if (e.action === "job.cancelled") {
      out.push({ key: e.id, at: e.occurred_at, text: `${who(e.actor)} closed a request that never started` });
    }
  }
  for (const [k, g] of inputs) {
    const parts = [g.given ? `added ${g.given} ${g.given === 1 ? "detail" : "details"}` : null, g.left ? `left ${g.left} out on purpose` : null].filter(Boolean).join(" and ");
    out.push({ key: `inputs:${k}`, at: g.at, text: `${who(g.actor)} ${parts}` });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** The events about one client: its proposals (any revision) and the jobs that belong to them. */
export function eventsFor(events: AuditEvent[], planIds: Set<string>, jobIds: Set<string>): AuditEvent[] {
  return events.filter((e) => {
    if (e.task_id && (planIds.has(e.task_id) || jobIds.has(e.task_id))) return true;
    const planId = (e.payload?.params as { planId?: string } | undefined)?.planId;
    return !!planId && planIds.has(planId);
  });
}
