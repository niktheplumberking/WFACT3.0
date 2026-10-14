/**
 * Every client the viewer can see, each with its six-step path (Cockpit v2). A client is the newest proposal for a
 * client (plans are grouped by client_slug) plus any project that has no proposal the viewer can read; a project is
 * matched to its proposal by the client's name, as before. Home, Projects and the attention list (Home "What needs
 * you" and Notifications) all read this one list, so they never disagree.
 */
import type { JobRow } from "../jobsClient";
import type { PlanInputRow } from "./inputs";
import { currentInputs } from "./inputs";
import { planName, type PlanRow, type ProjectRow, type Role } from "./model";
import { KIND_OF_SITE, derivePath, type PathResult } from "./path";
import { STAGES } from "../stages";

export interface ClientRow {
  key: string;
  name: string;
  /** "Fast local site", "Showcase site with motion", or null before the kind is chosen. */
  kind: string | null;
  plan: PlanRow | null;
  project: ProjectRow | null;
  /** null when the viewer cannot read the rows that decide it (a PM under RLS, or a project with no proposal). */
  path: PathResult | null;
  /** The client's page: /projects/:id when it has a project, else /clients/:slug (same page, keyed by the client). */
  href: string;
  /** When the client first appeared (the first proposal or the project). */
  since: string;
}

export interface ClientsInput {
  plans: PlanRow[];
  projects: ProjectRow[];
  jobs: JobRow[];
  inputs: PlanInputRow[];
  viewer: { role: Role | null; name?: string | null };
  decider: string;
  now?: number;
}

export function clientNameOf(p: PlanRow): string {
  return p.plan.plan.intake?.clientName?.trim() || planName(p);
}

const LIVE_FROM = STAGES.indexOf("8_launch");

export function clientsOf({ plans, projects, jobs, inputs, viewer, decider, now = Date.now() }: ClientsInput): ClientRow[] {
  const bySlug = new Map<string, PlanRow[]>();
  for (const p of plans) bySlug.set(p.client_slug, [...(bySlug.get(p.client_slug) ?? []), p]);
  const projectByName = new Map(projects.map((p) => [(p.clients?.name ?? p.name).toLowerCase(), p]));
  const used = new Set<string>();
  const rows: ClientRow[] = [];

  for (const [slug, list] of bySlug) {
    const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    // A pending or approved proposal is the live one; a rejected one is shown only when nothing newer exists.
    const plan = sorted.find((p) => p.status === "pending" || p.status === "approved") ?? sorted[0]!;
    const name = clientNameOf(plan);
    const project = projectByName.get(name.toLowerCase()) ?? null;
    if (project) used.add(project.id);
    const path = derivePath({ plan, jobs, inputs: currentInputs(inputs.filter((i) => i.plan_id === plan.id)), project, viewer, decider, now });
    rows.push({
      key: slug,
      name,
      kind: plan.build_track ? KIND_OF_SITE[plan.build_track] ?? null : null,
      plan,
      project,
      path,
      href: project ? `/projects/${project.id}` : `/clients/${slug}`,
      since: sorted[sorted.length - 1]!.created_at,
    });
  }

  // A project with no proposal the viewer can read: only a recorded launch is certain; otherwise say nothing.
  for (const project of projects) {
    if (used.has(project.id)) continue;
    const live = STAGES.indexOf(project.stage as (typeof STAGES)[number]) >= LIVE_FROM;
    const path = live ? derivePath({ plan: null, jobs: [], project, viewer, decider, now }) : null;
    rows.push({ key: `project:${project.id}`, name: project.clients?.name ?? project.name, kind: null, plan: null, project, path, href: `/projects/${project.id}`, since: project.created_at });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
