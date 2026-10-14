/**
 * How long builds usually take, from the factory's own past runs (BUILD-SPEED-UX P1): the median of past succeeded full
 * builds on the same track, and per-step medians from their agent.complete rows. Fewer than 3 past runs is "not enough to
 * estimate", never a guess.
 */
import type { JobRow } from "../jobsClient";
import { planIdOfJob } from "./attention";
import type { PlanRow } from "./model";
import { estimate, stepMedians, type Estimate } from "./timeline";
import { fetchStepDurations } from "./runInfo";

/** Past succeeded full builds (not resumes: a resume only does part of the work) of plans on `track`, newest first. */
export function pastBuildsOnTrack(jobs: JobRow[], plans: PlanRow[], track: string | null, excludeId?: string): JobRow[] {
  if (!track) return [];
  const trackOf = new Map(plans.map((p) => [p.id, p.build_track]));
  return jobs
    .filter((j) => j.id !== excludeId && j.kind === "build_plan" && j.status === "succeeded" && j.started_at && j.finished_at)
    .filter((j) => {
      const pid = planIdOfJob(j, jobs);
      return !!pid && trackOf.get(pid) === track;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function durationsOf(jobs: JobRow[]): number[] {
  return jobs.map((j) => new Date(j.finished_at!).getTime() - new Date(j.started_at!).getTime());
}

export interface BuildStats {
  total: Estimate;
  steps: { build: number | null; qa: number | null };
}

export async function loadBuildStats(jobs: JobRow[], plans: PlanRow[], track: string | null, excludeId?: string): Promise<BuildStats> {
  const past = pastBuildsOnTrack(jobs, plans, track, excludeId).slice(0, 12);
  const total = estimate(durationsOf(past));
  const runIds = past.map((j) => j.result?.workflowRunId).filter((x): x is string => typeof x === "string");
  const steps = total.kind === "ok" ? stepMedians(await fetchStepDurations(runIds)) : { build: null, qa: null };
  return { total, steps };
}
