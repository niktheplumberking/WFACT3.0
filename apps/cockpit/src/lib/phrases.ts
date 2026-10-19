/**
 * One phrase table for the audit trail (Cockpit v2): every person-made action said in plain words, never as its raw
 * slug. The project page's decisions timeline uses it now; the Activity room reuses it. An action this table does not
 * know is left out, rather than shown as a slug.
 *
 * Linking (checked against live rows, 2026-10-14): plan.decision and plan.input carry the proposal id in task_id;
 * job.requested carries the job id in task_id and the proposal id in payload.params.planId (or the run it reopens).
 * account.approved / account.rejected (written by the decide_account_request rpc, 2026-10-16) carry user_id and role.
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

export const PERSON_ACTIONS = ["plan.decision", "plan.input", "job.requested", "job.archived", "job.cancelled", "account.approved", "account.rejected"] as const;

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

const ROLE_WORDS: Record<string, string> = { owner: "an owner", admin: "an admin", pm: "a project manager" };

/** The Activity room's type pills. "other" shows under Everything only. */
export type ActivityType = "decision" | "build" | "stop" | "round" | "detail" | "team" | "other";
/** Which glyph a line carries (the Activity room picks the icon). */
export type Glyph = "approved" | "changes" | "detail" | "build" | "continue" | "question" | "proposal" | "archive" | "cancel" | "team" | "declined";

/** One person-made event, said in plain words without the subject: who did it is `actor`, what they did is `verb`. */
export interface PersonLine {
  key: string;
  at: string;
  actor: string;
  verb: string;
  type: ActivityType;
  glyph: Glyph;
  /** The proposal or job the event is about, so the Activity room can name the client. */
  planId: string | null;
  jobId: string | null;
}

const JOB_TYPE: Record<string, [ActivityType, Glyph]> = {
  intake: ["build", "proposal"],
  build_plan: ["build", "build"],
  resume: ["build", "continue"],
  replan: ["decision", "changes"],
  direction: ["decision", "changes"],
  verify: ["build", "build"],
  ask: ["other", "question"],
};

/** Every person-made event the table knows, newest first. Details added together become one line; unknown actions are left out. */
export function personLines(events: AuditEvent[], people: Record<string, string>): PersonLine[] {
  const out: PersonLine[] = [];
  const inputs = new Map<string, { at: string; actor: string; planId: string | null; given: number; left: number }>();
  const base = (e: AuditEvent) => ({ key: e.id, at: e.occurred_at, actor: e.actor });
  for (const e of events) {
    const p = e.payload ?? {};
    if (e.action === "plan.decision") {
      const status = p.status as string | undefined;
      const kind = typeof p.buildTrack === "string" ? KIND_OF_SITE[p.buildTrack] : null;
      if (status === "approved") out.push({ ...base(e), verb: `approved the proposal${kind ? `: ${kind}` : ""}`, type: "decision", glyph: "approved", planId: e.task_id, jobId: null });
      else if (status === "rejected") out.push({ ...base(e), verb: "asked for changes to the proposal", type: "decision", glyph: "changes", planId: e.task_id, jobId: null });
    } else if (e.action === "plan.input") {
      const k = `${e.actor}|${e.occurred_at}|${e.task_id}`;
      const g = inputs.get(k) ?? { at: e.occurred_at, actor: e.actor, planId: e.task_id, given: 0, left: 0 };
      if (p.waived) g.left += 1;
      else g.given += 1;
      inputs.set(k, g);
    } else if (e.action === "job.requested") {
      const kind = p.kind as string;
      const words = JOB_PHRASE[kind];
      const planId = (p.params as { planId?: string } | undefined)?.planId ?? null;
      if (words) out.push({ ...base(e), verb: words, type: JOB_TYPE[kind]![0], glyph: JOB_TYPE[kind]![1], planId, jobId: e.task_id });
    } else if (e.action === "job.archived") {
      out.push({ ...base(e), verb: "put a stopped build away", type: "build", glyph: "archive", planId: null, jobId: e.task_id });
    } else if (e.action === "job.cancelled") {
      out.push({ ...base(e), verb: "closed a request that never started", type: "build", glyph: "cancel", planId: null, jobId: e.task_id });
    } else if (e.action === "account.approved") {
      const role = ROLE_WORDS[p.role as string];
      const name = typeof p.user_id === "string" ? people[p.user_id] : undefined;
      if (role) out.push({ ...base(e), verb: `approved ${name ? `${name}’s account` : "an account"} as ${role}`, type: "team", glyph: "team", planId: null, jobId: null });
    } else if (e.action === "account.rejected") {
      out.push({ ...base(e), verb: "declined an account request", type: "team", glyph: "declined", planId: null, jobId: null });
    }
  }
  for (const [k, g] of inputs) {
    const parts = [g.given ? `added ${g.given} ${g.given === 1 ? "detail" : "details"}` : null, g.left ? `left ${g.left} out on purpose` : null].filter(Boolean).join(" and ");
    out.push({ key: `inputs:${k}`, at: g.at, actor: g.actor, verb: parts, type: "detail", glyph: "detail", planId: g.planId, jobId: null });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export interface Phrase {
  key: string;
  text: string;
  at: string;
}

/** Who did it, as the timeline says it: "You" for the viewer, a first name, or "Someone" when profiles cannot be read. */
export const whoOf = (id: string, people: Record<string, string>, me: string | null) => (id === me ? "You" : people[id] ?? "Someone");

/** Plain sentences for a set of events, newest first. Details added together become one line. */
export function phrase(events: AuditEvent[], people: Record<string, string>, me: string | null): Phrase[] {
  return personLines(events, people).map((l) => ({ key: l.key, at: l.at, text: `${whoOf(l.actor, people, me)} ${l.verb}` }));
}

/** The events about one client: its proposals (any revision) and the jobs that belong to them. */
export function eventsFor(events: AuditEvent[], planIds: Set<string>, jobIds: Set<string>): AuditEvent[] {
  return events.filter((e) => {
    if (e.task_id && (planIds.has(e.task_id) || jobIds.has(e.task_id))) return true;
    const planId = (e.payload?.params as { planId?: string } | undefined)?.planId;
    return !!planId && planIds.has(planId);
  });
}

/**
 * Who found or fixed a round of fixes (correction_rounds.flagged_by / fixed_by), in plain words. The rows name a role and,
 * in brackets, the model or vendor behind it (live 2026-10-20: "evaluator (claude)", "frontend-loop (builder: agent37)");
 * only the role reaches the screen. Anything this table does not know is left unnamed (null), never shown raw.
 */
export function roundActor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (/evaluat|review/.test(r)) return "the independent reviewer";
  if (/frontend-loop|builder/.test(r)) return "the builder";
  if (/\bqa\b|check|verif/.test(r)) return "the automatic checks";
  return null;
}
