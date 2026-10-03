/**
 * Shared row types, plain-language copy and formatting for the Cockpit (Step 4C copy guide,
 * docs/step-4c/PHASE-1-PROPOSAL.md §4). Rows mirror the tables RLS lets the browser read; nothing here
 * talks to the database.
 */
import type { JobKind, JobRow } from "../jobsClient";
import { isStaleQueued } from "../jobsClient";

export type Role = "owner" | "admin" | "pm";
export type Track = "A" | "B";

export interface Quoted {
  point: string;
  quote: string;
}

export interface Direction {
  taxonomyVersion?: string;
  niche: string;
  nicheLabel: string;
  nicheQuote: string | null;
  audience: Quoted | null;
  primaryGoal: string;
  goalQuote: string | null;
  requirements: Quoted[];
  constraints: Quoted[];
  brandDirection: (Quoted & { aspect: string })[];
  recommendation: { track: Track | null; confidence: number; reasons: string[]; withheldReason: string | null };
  openQuestions: string[];
  unsupported: string[];
}

export interface PlanBody {
  plan: {
    templateId: string;
    templateRationale: string;
    brief: { projectName: string; goal: string; brandNotes?: string; requiredSections: string[] };
    tasks: { order: number; role: string; stage: string; title: string }[];
    risks: string[];
    openQuestions: string[];
    intake: { entitySlug: string; leadType: string; clientName: string; requestSource?: string };
  };
  direction?: Direction | null;
  directionNote?: string | null;
}

export interface PlanRow {
  id: string;
  created_at: string;
  client_slug: string;
  entity_slug: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  revision: number;
  decision_note: string | null;
  decided_at?: string | null;
  build_track: Track | null;
  track_overridden: boolean | null;
  plan: PlanBody;
}

export const PLAN_COLUMNS = "id,created_at,client_slug,entity_slug,status,revision,decision_note,decided_at,build_track,track_overridden,plan";

export interface ProjectRow {
  id: string;
  name: string;
  stage: string;
  status: string;
  created_at: string;
  client_id?: string;
  clients: { name: string; entities: { name: string } | null } | null;
}

export interface AccountRequestRow {
  user_id: string;
  email: string;
  full_name: string | null;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  decided_role: string | null;
  decision_note: string | null;
}

export interface RoundRow {
  id: string;
  round_number: number;
  stage: string;
  flagged_by: string;
  issue: string;
  fixed_by: string | null;
  created_at: string;
  projects: { name: string } | null;
}

/* ---------------- copy ---------------- */

export const KIND_LABEL: Record<JobKind, string> = {
  intake: "Read request and plan",
  replan: "Re-plan from note",
  build_plan: "Build and check",
  resume: "Resume build",
  verify: "Re-check a page",
  ask: "Question",
};

export const LEAD_LABEL: Record<string, string> = {
  new_website: "New website",
  redesign: "Redesign",
  care_plan: "Care plan",
  other: "Other request",
};

export const GOAL_LABEL: Record<string, string> = {
  call: "phone calls",
  booking: "bookings",
  quote_form: "quote requests",
  purchase: "purchases",
  enquiry: "enquiries",
  portfolio_view: "portfolio views",
  other: "other",
};

export const TRACKS: { id: Track; name: string; summary: string }[] = [
  { id: "A", name: "Track A: local business site", summary: "Several fast pages, click-to-call and a quote form." },
  {
    id: "B",
    name: "Track B: motion-rich brand site",
    summary: "Scroll-driven motion and rich sections, built as a Next.js static site.",
  },
];

export type Tone = "clear" | "caution" | "stop" | "idle";

export interface JobState {
  label: string;
  tone: Tone;
}

/** The one word (plus colour) a person sees for a job. */
export function jobState(j: JobRow, now = Date.now()): JobState {
  switch (j.status) {
    case "queued":
      return isStaleQueued(j, now) ? { label: "Never started", tone: "stop" } : { label: "Waiting to start", tone: "idle" };
    case "dispatched":
      return { label: "Starting", tone: "idle" };
    case "running":
      return { label: "Running", tone: "idle" };
    case "cancelled":
      return { label: "Cancelled", tone: "idle" };
    case "failed":
      return { label: "Failed", tone: "stop" };
    case "succeeded":
      if (j.kind === "build_plan" || j.kind === "resume") return { label: "Verified", tone: "clear" };
      if (j.kind === "verify") return { label: "Checks passed", tone: "clear" };
      return { label: "Done", tone: "clear" };
  }
}

export interface Explanation {
  /** Completes "Build stopped: …" style titles. */
  headline: string;
  happened: string;
  todo: string;
}

/**
 * Turn a failed job's raw error into what happened and what to do (copy guide rule 3). The raw message
 * stays one click away in Technical details; this never hides it, it only leads with plain words.
 */
export function explainJobError(j: Pick<JobRow, "error" | "result" | "kind" | "gh_run_url">): Explanation {
  const e = j.error ?? "";
  const r = j.result ?? {};
  if (/credits exhausted|HTTP 402/i.test(e)) {
    return {
      headline: "the site builder is out of credits",
      happened: "Agent 37, the service that writes the site, refused the job because the account has no AI credits left. Nothing was built and nothing was published.",
      todo: "Topping up Agent 37 is a money decision. Once credits are added, press Resume build: it restarts from the last saved step.",
    };
  }
  if (/GITHUB_DISPATCH_TOKEN|Dispatcher not configured/i.test(e)) {
    return {
      headline: "the factory worker isn't connected",
      happened: "The request was saved, but the Cockpit couldn't hand it to the factory worker on GitHub because the dispatch token is missing. Nothing ran.",
      todo: "Ask Huraira to set the dispatch token (docs/COCKPIT-JOBS.md), then start the request again.",
    };
  }
  if (/no Track B builder configured/i.test(e)) {
    return {
      headline: "the factory worker has no Track B builder",
      happened: "This plan was approved as Track B, but the factory worker that picked it up has no Track B builder. It was not built as Track A. Nothing ran.",
      todo: "Ask Huraira to check the factory worker's Track B setup, then start the build again.",
    };
  }
  if (/no build track/i.test(e)) {
    return {
      headline: "this plan has no build track",
      happened: "The plan was approved before the track choice existed, so the factory won't guess one. Nothing ran.",
      todo: "Start a new request for this client and approve the new plan with a track.",
    };
  }
  // A required review (the design reviewer) could not run, e.g. its gateway was down: the site passed every
  // automatic check but cannot be called verified (2026-10-03, job 5c85914b, HTTP 502 four times).
  if (/a required review could not run/i.test(e)) {
    return {
      headline: "the final review couldn't run",
      happened:
        "The site was built and passed every automatic check, but the design review service didn't answer, so the result is not marked verified. Nothing is wrong with the site's checks.",
      todo: "Start the build again in a little while. If it happens twice in a row, ask Huraira to check the reviewer service.",
    };
  }
  // Older runs recorded both situations with one message, so it cannot tell them apart.
  if (/no evaluator model was configured/i.test(e)) {
    return {
      headline: "the final review didn't run",
      happened:
        "The site was built and passed every automatic check, but the last review step didn't run, so the result is not marked verified. On this kind of older run that usually means the review service was briefly unreachable; it can also mean a reviewer key is missing.",
      todo: "Start the build again. If it happens again, ask Huraira to check the reviewer and evaluator setup.",
    };
  }
  if (/^Cancelled by/i.test(e)) {
    return { headline: "it was cancelled", happened: e, todo: "Nothing to do. Start a new request if the work is still needed." };
  }
  if (/runner crashed/i.test(e)) {
    return {
      headline: "the worker stopped before reporting",
      happened: "The factory worker stopped before it could record a result, so the outcome is unknown.",
      todo: "Open the GitHub run log to see where it stopped, then resume or start again.",
    };
  }
  if (r.status === "failed_verification" || /verification (rejected|failed)/i.test(e)) {
    return {
      headline: "the result failed its checks",
      happened: "The factory built it, but the independent checks didn't pass, so it was not marked done. The failed checks are listed below.",
      todo: "Read the failed checks. Resume the build to let the builder fix them, or re-plan if the plan itself is wrong.",
    };
  }
  const first = e.split(/(?<=[.!?])\s/)[0]?.slice(0, 220) || "The job failed without a message.";
  return {
    headline: "something went wrong",
    happened: first,
    todo: j.gh_run_url ? "Open Technical details or the GitHub run log for the full story." : "Open Technical details for the full message.",
  };
}

/* ---------------- formatting ---------------- */

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export function shortDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function dateTime(iso: string): string {
  return `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))}`;
}

export function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
}

export function duration(fromIso: string | null, toIso: string | null): string | null {
  if (!fromIso || !toIso) return null;
  const s = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60} s`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "";
}

export function planName(p: PlanRow | undefined | null): string {
  return p?.plan?.plan?.brief?.projectName ?? "Untitled plan";
}
