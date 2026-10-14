/**
 * App-wide state: who is signed in (and their role, from profiles), one shared poller for the rows Home
 * and the Decisions badge need, a small load hook for pages, and toasts. Every read uses the signed-in
 * session; RLS decides what comes back. A role here only hides controls the database would refuse anyway.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "../supabaseClient";
import { JOB_COLUMNS, isActive, type JobRow } from "../jobsClient";
import { applyAppearance, readAppearance, saveAppearance, type Theme } from "./appearance";
import { buildAttention, type AttentionItem } from "./attention";
import { PLAN_COLUMNS, type AccountRequestRow, type PlanRow, type ProjectRow, type Role } from "./model";
import { clientsOf, type ClientRow } from "./clients";
import type { PlanInputRow } from "./inputs";

/* ---------------- session ---------------- */

export interface Me {
  userId: string;
  email: string;
  role: Role | null;
  fullName: string | null;
}

const MeContext = createContext<Me | null>(null);
export const MeProvider = MeContext.Provider;

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside a signed-in shell");
  return me;
}

export const canDecide = (role: Role | null) => role === "owner" || role === "admin";

/* ---------------- load hook ---------------- */

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/** Run `fn` on mount and when `deps` change; optional polling while `pollWhile(data)` is true. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], opts: { pollMs?: number; pollWhile?: (d: T) => boolean } = {}): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const alive = useRef(true);

  const reload = useCallback(async () => {
    try {
      const d = await fnRef.current();
      if (!alive.current) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    reload();
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const { pollMs, pollWhile } = opts;
  useEffect(() => {
    if (!pollMs || data === null || (pollWhile && !pollWhile(data))) return;
    const t = setInterval(reload, pollMs);
    return () => clearInterval(t);
  }, [data, pollMs, pollWhile, reload]);

  return { data, error, loading, reload };
}

/** Throw the PostgREST error so useLoad shows it, instead of silently rendering an empty list. */
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? ([] as unknown)) as T;
}

/* ---------------- fetchers ---------------- */

export async function fetchJobs(limit = 100): Promise<JobRow[]> {
  return must(await supabase.from("jobs").select(JOB_COLUMNS).order("created_at", { ascending: false }).limit(limit)) as JobRow[];
}

export async function fetchJob(id: string): Promise<JobRow | null> {
  const res = await supabase.from("jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as JobRow | null) ?? null;
}

export async function fetchPlans(): Promise<PlanRow[]> {
  return must(
    await supabase.from("plan_approvals").select(PLAN_COLUMNS).in("status", ["pending", "approved", "rejected"]).order("created_at", { ascending: false }).limit(50),
  ) as PlanRow[];
}

export async function fetchPlan(id: string): Promise<PlanRow | null> {
  const res = await supabase.from("plan_approvals").select(PLAN_COLUMNS).eq("id", id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as PlanRow | null) ?? null;
}

export async function fetchAccounts(): Promise<AccountRequestRow[]> {
  return must(
    await supabase
      .from("account_requests")
      .select("user_id,email,full_name,status,requested_at,decided_role,decision_note")
      .order("requested_at", { ascending: false })
      .limit(50),
  ) as AccountRequestRow[];
}

export async function fetchProjects(): Promise<ProjectRow[]> {
  const res = await supabase.from("projects").select("id,name,stage,status,created_at,client_id,clients(name,entities(name))").order("created_at", { ascending: false });
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as unknown as ProjectRow[];
}

/** Every current detail row (owner/admin under RLS). Missing table (before migration 0018) reads as none. */
export async function fetchAllPlanInputs(): Promise<PlanInputRow[]> {
  const res = await supabase.from("plan_inputs").select("id,created_at,plan_id,kind,key,label,value,waived").order("created_at", { ascending: true }).limit(2000);
  if (res.error) return [];
  return (res.data ?? []) as PlanInputRow[];
}

/** The owner's first name: the person who decides proposals, the finished site and money ("Nick decides this"). */
export async function fetchDeciderName(): Promise<string | null> {
  // A name is a nicety: if it cannot be read, the words fall back to "the owner" and nothing else fails.
  try {
    const res = await supabase.from("profiles").select("full_name").eq("role", "owner").order("created_at", { ascending: true }).limit(1);
    const name = (res.data?.[0] as { full_name?: string | null } | undefined)?.full_name?.trim();
    return name ? name.split(/\s+/)[0]! : null;
  } catch {
    return null;
  }
}

/* ---------------- shared factory state (Home, Projects, Notifications, the shell's counts) ---------------- */

interface Factory {
  jobs: JobRow[] | null;
  plans: PlanRow[] | null;
  accounts: AccountRequestRow[] | null;
  projects: ProjectRow[] | null;
  /** Every client with its six-step path (lib/clients.ts). */
  clients: ClientRow[] | null;
  attention: AttentionItem[];
  decisions: number;
  /** The owner's first name, or "the owner" when it cannot be read. */
  decider: string;
  error: string | null;
  reload: () => Promise<void>;
}

const FactoryContext = createContext<Factory | null>(null);

export function FactoryProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const decider = canDecide(me.role);
  const load = useLoad(
    async () => {
      // PMs read only their assigned projects (RLS); plans, jobs and details are owner/admin.
      if (!decider) return { jobs: [] as JobRow[], plans: [] as PlanRow[], accounts: [] as AccountRequestRow[], projects: await fetchProjects(), inputs: [] as PlanInputRow[], deciderName: null as string | null };
      const [jobs, plans, accounts, projects, inputs, deciderName] = await Promise.all([fetchJobs(), fetchPlans(), fetchAccounts(), fetchProjects(), fetchAllPlanInputs(), fetchDeciderName()]);
      return { jobs, plans, accounts, projects, inputs, deciderName };
    },
    [me.userId, decider],
    { pollMs: 5000, pollWhile: (d) => d.jobs.some((j) => isActive(j)) },
  );
  // A slow background refresh as well, so a decision made elsewhere shows up without a reload.
  useEffect(() => {
    const t = setInterval(load.reload, 60_000);
    return () => clearInterval(t);
  }, [load.reload]);

  const value = useMemo<Factory>(() => {
    const d = load.data;
    const deciderName = me.role === "owner" ? (me.fullName?.trim().split(/\s+/)[0] ?? "you") : (d?.deciderName ?? "the owner");
    const clients = d ? clientsOf({ plans: d.plans, projects: d.projects, jobs: d.jobs, inputs: d.inputs, viewer: { role: me.role, name: me.fullName }, decider: deciderName }) : null;
    const attention = d && clients ? buildAttention({ clients, jobs: d.jobs, accounts: d.accounts, myId: me.userId, canDecide: decider }) : [];
    return {
      jobs: d?.jobs ?? null,
      plans: d?.plans ?? null,
      accounts: d?.accounts ?? null,
      projects: d?.projects ?? null,
      clients,
      attention,
      decisions: attention.filter((i) => i.isDecision).length,
      decider: deciderName,
      error: load.error,
      reload: load.reload,
    };
  }, [load.data, load.error, load.reload, me.userId, me.role, me.fullName, decider]);

  return <FactoryContext.Provider value={value}>{children}</FactoryContext.Provider>;
}

export function useFactory(): Factory {
  const f = useContext(FactoryContext);
  if (!f) throw new Error("useFactory outside FactoryProvider");
  return f;
}

/* ---------------- theme (v2: light first; see lib/appearance.ts for accent, density, text size, motion) ---------------- */

export type ThemePref = Theme;

export function applyTheme(pref: ThemePref) {
  const a = { ...readAppearance(), theme: pref };
  saveAppearance(a);
  applyAppearance(a);
}

export function readThemePref(): ThemePref {
  return readAppearance().theme;
}

/* ---------------- toasts (v2: inverse ink, polite live region, 9 s, optional Undo / Changed my mind) ---------------- */

export interface ToastAction {
  label: string;
  run: () => void;
}
interface Toast {
  id: number;
  text: string;
  action?: ToastAction;
}
export const TOAST_MS = 9000;
type ShowToast = (text: string, action?: ToastAction) => void;
const ToastContext = createContext<ShowToast>(() => {});

/** A toast is never the only place information appears: the screen it came from shows the same state. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const drop = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback<ShowToast>(
    (text, action) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, text, action }]);
      setTimeout(() => drop(id), TOAST_MS);
    },
    [drop],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast enter">
            <span className="toast-text">{t.text}</span>
            {t.action && (
              <button
                type="button"
                className="toast-act"
                onClick={() => {
                  drop(t.id);
                  t.action!.run();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ---------------- notifications (v2): the same source as Home attention ---------------- */

const seenKey = (userId: string | null) => `cockpit-notifications-seen:${userId ?? "anon"}`;

/** An item is unread when it is newer than the last "Mark all as read" in this browser (per person). The bell and the
 *  Notifications inbox read this; nothing here invents an item. */
export function unreadOf(items: AttentionItem[], seenAt: string | null): AttentionItem[] {
  return seenAt ? items.filter((i) => i.at > seenAt) : items;
}

export function useNotifications() {
  const me = useMe();
  const { attention } = useFactory();
  const [seenAt, setSeenAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(seenKey(me.userId));
    } catch {
      return null;
    }
  });
  // Every bell and inbox on the page hears "Mark all as read" at once.
  useEffect(() => {
    const on = (e: Event) => setSeenAt((e as CustomEvent<string>).detail);
    window.addEventListener("cockpit-notifications-seen", on);
    return () => window.removeEventListener("cockpit-notifications-seen", on);
  }, []);
  const unread = useMemo(() => unreadOf(attention, seenAt), [attention, seenAt]);
  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(seenKey(me.userId), now);
    } catch {
      /* private mode: lasts for this visit */
    }
    window.dispatchEvent(new CustomEvent("cockpit-notifications-seen", { detail: now }));
  }, [me.userId]);
  return { items: attention, unread, isUnread: (i: AttentionItem) => unread.includes(i), markAllRead };
}
