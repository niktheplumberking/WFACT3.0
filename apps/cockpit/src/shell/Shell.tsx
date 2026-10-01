/**
 * The navigation shell (Step 4C IA): five working areas plus honest "Coming in Step N" entries, a
 * "New request" button and an "Ask the factory" box on every screen, a phone tab bar, and the account
 * menu. Controls a role can't use are hidden; RLS still refuses them if anyone tries.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  House, SealCheck, Path, ListChecks, Receipt, Heartbeat, Robot, Brain, Briefcase, UserCircle, Plus,
  ChatCircleText, DotsThreeOutline, SignOut, GearSix,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { requestJob } from "../jobsClient";
import { canDecide, useFactory, useMe, useToast } from "../lib/state";

interface NavEntry {
  to: string;
  label: string;
  icon: Icon;
  end?: boolean;
  badge?: number;
}

/** Rooms later steps build. Each shows an honest "Coming in Step N" page until then (Huraira, 2026-10-01). */
export const COMING: { slug: string; label: string; icon: Icon; step: number; what: string }[] = [
  { slug: "system", label: "System", icon: Heartbeat, step: 9, what: "Factory health in one place: whether the worker, database and models are up, how many jobs are waiting, the error rate, and when the last backup ran." },
  { slug: "agents", label: "Agents", icon: Robot, step: 10, what: "Every agent in the factory, what it is doing now, its success rate over time, and a drill-down from any failure to the exact check and trace." },
  { slug: "memory", label: "Memory", icon: Brain, step: 14, what: "What the factory has written to memory, contradictions it found, and stale facts to review. Escalations and blocked tasks join Decisions in the same step." },
  { slug: "business", label: "Business", icon: Briefcase, step: 23, what: "Owner's Key (client self-editing), closing reports and care plans, rebuilt on the new stack." },
];

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Home"],
  [/^\/decisions\/plans\//, "Plan decision"],
  [/^\/decisions/, "Decisions"],
  [/^\/projects\/new/, "New request"],
  [/^\/projects\/.+/, "Project"],
  [/^\/projects/, "Projects"],
  [/^\/activity\/.+/, "Run"],
  [/^\/activity/, "Activity"],
  [/^\/costs/, "Costs"],
  [/^\/soon/, "Coming next"],
  [/^\/settings/, "Settings"],
  [/^\/more/, "More"],
];

function crumbsFor(pathname: string): { label: string; to?: string }[] {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length === 0) return [{ label: "Home" }];
  const areas: Record<string, string> = { decisions: "Decisions", projects: "Projects", activity: "Activity", costs: "Costs", soon: "Coming next", settings: "Settings", more: "More" };
  const area = areas[seg[0]!] ?? seg[0]!;
  if (seg.length === 1) return [{ label: area }];
  const leaf = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "Details";
  return [{ label: area, to: `/${seg[0]}` }, { label: leaf }];
}

function AccountMenu() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={wrap}>
      {open && (
        <div className="menu" id="account-menu">
          <Link to="/settings" onClick={() => setOpen(false)}>
            <GearSix aria-hidden="true" />
            Settings
          </Link>
          <button type="button" onClick={() => supabase.auth.signOut()}>
            <SignOut aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
      <button className="who" type="button" aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen(!open)}>
        <UserCircle aria-hidden="true" size={28} />
        <span>
          <b>{me.fullName ?? me.email}</b>
          <small>{me.role ? `${me.role[0]!.toUpperCase()}${me.role.slice(1)}. Account, sign out` : "Account, sign out"}</small>
        </span>
      </button>
    </div>
  );
}

function AskBox() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      className="ask"
      role="search"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!q.trim() || busy) return;
        setBusy(true);
        const { jobId, error } = await requestJob("ask", { question: q.trim() });
        setBusy(false);
        if (error && !jobId) return toast(`Your question wasn't sent: ${error}`);
        setQ("");
        if (error) toast(error);
        if (jobId) nav(`/activity/${jobId}`);
      }}
    >
      <ChatCircleText aria-hidden="true" />
      <label htmlFor="ask-q" className="sr-only">
        Ask the factory a question
      </label>
      <input id="ask-q" ref={input} placeholder="Ask the factory a question" maxLength={500} value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} />
      <kbd aria-hidden="true">/</kbd>
    </form>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const me = useMe();
  const { decisions } = useFactory();
  const { pathname } = useLocation();
  const decider = canDecide(me.role);
  const crumbs = crumbsFor(pathname);
  const mainRef = useRef<HTMLElement>(null);

  // One title per screen, and focus moves to the content on navigation so screen readers hear the new page.
  const first = useRef(true);
  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "Cockpit";
    document.title = `${t} · WFACT Cockpit`;
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  const nav: NavEntry[] = [
    { to: "/", label: "Home", icon: House, end: true },
    ...(decider ? [{ to: "/decisions", label: "Decisions", icon: SealCheck, badge: decisions }] : []),
    { to: "/projects", label: "Projects", icon: Path },
    ...(decider ? [{ to: "/activity", label: "Activity", icon: ListChecks }] : []),
    ...(me.role === "owner" ? [{ to: "/costs", label: "Costs", icon: Receipt }] : []),
  ];

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="shell">
        <aside className="rail" aria-label="Main">
          <Link to="/" className="mark" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="mark-glyph" aria-hidden="true">WF</span>
            <span className="mark-name">
              WFACT<span>Cockpit</span>
            </span>
          </Link>
          <nav className="nav" aria-label="Main navigation">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                <n.icon aria-hidden="true" />
                {n.label}{" "}
                {!!n.badge && (
                  <span className="count">
                    {n.badge}
                    {" "}<span className="sr-only">waiting</span>
                  </span>
                )}
              </NavLink>
            ))}
            <div className="nav-group" id="soon-label">
              Coming next
            </div>
            {COMING.map((c) => (
              <NavLink key={c.slug} to={`/soon/${c.slug}`} className="soon" aria-describedby="soon-label">
                <c.icon aria-hidden="true" />
                {c.label}{" "}
                <span className="step">Step {c.step}</span>
              </NavLink>
            ))}
          </nav>
          <div className="rail-foot">
            <AccountMenu />
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <nav className="crumbs" aria-label="Breadcrumb">
              {/* Flat siblings, so the phone layout can hide everything but the current page. */}
              {crumbs.flatMap((c, i) => [
                ...(i > 0 ? [<span key={`s${i}`} aria-hidden="true">/</span>] : []),
                c.to ? <Link key={`c${i}`} to={c.to}>{c.label}</Link> : <span key={`c${i}`} aria-current="page">{c.label}</span>,
              ])}
            </nav>
            <span className="spacer" />
            {decider && <AskBox />}
            {decider && (
              <Link className="btn primary" to="/projects/new">
                <Plus aria-hidden="true" />
                New request
              </Link>
            )}
          </header>
          <main id="main" className="page" ref={mainRef} tabIndex={-1} style={{ outline: "none" }}>
            {children}
          </main>
        </div>
      </div>
      <nav className="tabbar" aria-label="Phone navigation" style={{ gridTemplateColumns: `repeat(${decider ? 4 : 3}, 1fr)` }}>
        <NavLink to="/" end>
          <House aria-hidden="true" />
          Home
        </NavLink>
        {decider && (
          <NavLink to="/decisions">
            <SealCheck aria-hidden="true" />
            Decisions{" "}
            {!!decisions && (
              <span className="count">
                {decisions}
                {" "}<span className="sr-only">waiting</span>
              </span>
            )}
          </NavLink>
        )}
        <NavLink to="/projects">
          <Path aria-hidden="true" />
          Projects
        </NavLink>
        <NavLink to="/more">
          <DotsThreeOutline aria-hidden="true" />
          More
        </NavLink>
      </nav>
    </>
  );
}
