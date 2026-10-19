/**
 * Personal preferences kept in this browser (Cockpit v2 Settings, phase 17): the Home section order, where the Cockpit
 * opens, and the saved views of Projects and Activity. The database has no place for per-person settings yet
 * (profiles: id, role, full_name, created_at; checked 2026-10-16, BLOCKED-ON-NICK.md), so every one of these lives on
 * this device only, and the screens say so. Appearance is lib/appearance.ts; Simple/Detailed is lib/detail.tsx.
 */
import type { Role } from "./model";

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown | null) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: lasts for this visit */
  }
}

/* ---------------- Home sections ---------------- */

export type HomeSection = "needs" | "overview" | "clients";
export const HOME_SECTIONS: HomeSection[] = ["needs", "overview", "clients"];
export const HOME_SECTION_NAME: Record<HomeSection, string> = { needs: "What needs you", overview: "Running now and this month", clients: "Every client" };
const HOME_KEY = "cockpit-home";

export interface HomeLayout {
  order: HomeSection[];
  hidden: HomeSection[];
}
export function readHomeLayout(): HomeLayout {
  const v = read<{ order?: unknown; hidden?: unknown }>(HOME_KEY);
  const valid = (x: unknown): x is HomeSection => HOME_SECTIONS.includes(x as HomeSection);
  const order = Array.isArray(v?.order) ? v!.order.filter(valid) : [];
  const hidden = Array.isArray(v?.hidden) ? v!.hidden.filter(valid) : [];
  return { order: [...order, ...HOME_SECTIONS.filter((x) => !order.includes(x))], hidden };
}
export const writeHomeLayout = (l: HomeLayout) => write(HOME_KEY, l);

/* ---------------- where the Cockpit opens ---------------- */

export type Landing = "/" | "/projects" | "/activity";
export const LANDING_NAME: Record<Landing, string> = { "/": "Home: what needs me", "/projects": "Projects", "/activity": "Activity" };
const LANDING_KEY = "cockpit-landing";
/** Activity is owner/admin under RLS, so a project manager never lands there. */
export const landingsFor = (role: Role | null): Landing[] => (role === "owner" || role === "admin" ? ["/", "/projects", "/activity"] : ["/", "/projects"]);
export function readLanding(role: Role | null): Landing {
  const v = read<string>(LANDING_KEY);
  return landingsFor(role).includes(v as Landing) ? (v as Landing) : "/";
}
export const writeLanding = (l: Landing) => write(LANDING_KEY, l === "/" ? null : l);

/* ---------------- saved views ---------------- */

export const PROJECTS_VIEW_KEY = "cockpit-projects-view";
export const activityViewKey = (userId: string | null) => `cockpit-activity-view:${userId ?? "anon"}`;

export interface SavedView {
  key: string;
  room: "Projects" | "Activity";
  summary: string;
}

const PROJECT_FILTER: Record<string, string> = { all: "All", need: "Needs someone", run: "Running", stop: "Stopped", ready: "Ready for approval" };
const PROJECT_SORT: Record<string, string> = { need: "needs someone first", newest: "newest first", name: "by name", build: "by last build" };
const ACTIVITY_TYPE: Record<string, string> = { all: "Everything", decision: "Decisions", build: "Builds", stop: "Stops", detail: "Details", team: "Team" };

/** The views saved on this device, in words. Person filters are said as "one person" (the name needs the team list). */
export function savedViews(userId: string | null): SavedView[] {
  const out: SavedView[] = [];
  const p = read<{ query?: string; filter?: string; sort?: string; view?: string }>(PROJECTS_VIEW_KEY);
  if (p) {
    const parts = [PROJECT_FILTER[p.filter ?? "all"] ?? "All", PROJECT_SORT[p.sort ?? "need"] ?? null, p.view === "list" ? "list" : "grid", p.query ? `search “${p.query}”` : null].filter(Boolean);
    out.push({ key: PROJECTS_VIEW_KEY, room: "Projects", summary: parts.join(" · ") });
  }
  const a = read<{ client?: string; person?: string; type?: string }>(activityViewKey(userId));
  if (a) {
    const parts = [ACTIVITY_TYPE[a.type ?? "all"] ?? "Everything", a.client && a.client !== "all" ? a.client : "all clients", a.person && a.person !== "all" ? (a.person === "factory" ? "the factory" : "one person") : null].filter(Boolean);
    out.push({ key: activityViewKey(userId), room: "Activity", summary: parts.join(" · ") });
  }
  return out;
}
export const deleteSavedView = (key: string) => write(key, null);

/* ---------------- notifications: where they reach you (one wording for Settings and Notifications) ---------------- */

/** Measured 2026-10-16: the factory has no email or phone sender and no table for notification choices (only the
 *  dispatch-job and submit-lead functions; profiles has id, role, full_name, created_at). So the Cockpit itself is the
 *  only channel, always on, and nothing on screen pretends otherwise (BLOCKED-ON-NICK.md, notification channels). */
export const NOTIFY_LINES = {
  where: "Notifications reach you in the Cockpit only: the bell at the top and Home. That is always on, for every kind of notification.",
  channels: "Email and phone are not connected yet, so there is nothing to switch on or off for them.",
  quiet: "Quiet hours and a daily digest have nothing to hold back until email or phone is connected.",
} as const;
