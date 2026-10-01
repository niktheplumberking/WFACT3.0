/**
 * App-wide state: who is signed in (and their role, from profiles), one shared poller for the rows Home
 * and the Decisions badge need, a small load hook for pages, and toasts. Every read uses the signed-in
 * session; RLS decides what comes back. A role here only hides controls the database would refuse anyway.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "../supabaseClient";
import { JOB_COLUMNS, isActive, type JobRow } from "../jobsClient";
import { buildAttention, type AttentionItem } from "./attention";
import { PLAN_COLUMNS, type AccountRequestRow, type PlanRow, type Role } from "./model";

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

/* ---------------- shared factory state (Home + Decisions badge) ---------------- */

interface Factory {
  jobs: JobRow[] | null;
  plans: PlanRow[] | null;
  accounts: AccountRequestRow[] | null;
  attention: AttentionItem[];
  decisions: number;
  error: string | null;
  reload: () => Promise<void>;
}

const FactoryContext = createContext<Factory | null>(null);

export function FactoryProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const decider = canDecide(me.role);
  const load = useLoad(
    async () => {
      if (!decider) return { jobs: [] as JobRow[], plans: [] as PlanRow[], accounts: [] as AccountRequestRow[] };
      const [jobs, plans, accounts] = await Promise.all([fetchJobs(), fetchPlans(), fetchAccounts()]);
      return { jobs, plans, accounts };
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
    const attention = d ? buildAttention({ plans: d.plans, jobs: d.jobs, accounts: d.accounts, myId: me.userId, canDecide: decider }) : [];
    return {
      jobs: d?.jobs ?? null,
      plans: d?.plans ?? null,
      accounts: d?.accounts ?? null,
      attention,
      decisions: attention.filter((i) => i.isDecision).length,
      error: load.error,
      reload: load.reload,
    };
  }, [load.data, load.error, load.reload, me.userId, decider]);

  return <FactoryContext.Provider value={value}>{children}</FactoryContext.Provider>;
}

export function useFactory(): Factory {
  const f = useContext(FactoryContext);
  if (!f) throw new Error("useFactory outside FactoryProvider");
  return f;
}

/* ---------------- theme (dark first; light is the daylight panel) ---------------- */

export type ThemePref = "system" | "dark" | "light";

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && !window.matchMedia?.("(prefers-color-scheme: light)").matches);
  if (dark) document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", "light");
}

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem("cockpit-theme");
    // Dark first (Step 4C brief); "Match this device" and light are a choice in Settings.
    return v === "system" || v === "light" ? v : "dark";
  } catch {
    return "dark";
  }
}

/* ---------------- toasts ---------------- */

interface Toast {
  id: number;
  text: string;
}
const ToastContext = createContext<(text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
