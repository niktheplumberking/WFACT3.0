/**
 * The navigation shell (Cockpit v2, docs/design/cockpit-v2). Desktop: a 236 px rail (typeset wordmark, nav with the
 * count of things that need you, "Coming later", Simple/Detailed, account) and a 68 px top bar (breadcrumb, "Search or
 * run a command ⌘K", the bell, New request). Phone: a 60 px header (back, title, search, bell) and a tab bar (Home,
 * Projects, New, Activity, More). Keyboard: ⌘K / Ctrl+K, /, G then H P A C, N, D, ?, Esc.
 *
 * Who sees what follows RLS, not the design where they disagree (BLOCKED-ON-NICK.md, 2026-10-14): Activity and Team are
 * owner/admin (audit_log, jobs and account_requests are owner/admin only); Costs is owner only (model_traces is owner
 * only). "Ask the factory a question" is a palette action (locked decision 5), using requestJob("ask", …).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  House, SquaresFour, ListBullets, Coins, UsersThree, Bell, GearSix, Heartbeat, Robot, Brain, Briefcase, Plus,
  MagnifyingGlass, CaretLeft, DotsThreeOutline, ChatCircleText, SlidersHorizontal, PlayCircle, Moon, Sun, Keyboard,
  Storefront, X,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { requestJob, isActive } from "../jobsClient";
import { canDecide, useFactory, useMe, useNotifications, useToast } from "../lib/state";
import { useDetail } from "../lib/detail";
import { applyAppearance, isDark, readAppearance, saveAppearance } from "../lib/appearance";
import { STEP_NAMES } from "../lib/path";
import { Segmented, Wordmark } from "../components/kit";
import { CommandPalette, type PaletteItem } from "../components/CommandPalette";

/** Rooms later steps build. Each shows an honest "Coming later" page until then: nothing rather than made-up numbers. */
export const COMING: { slug: string; label: string; icon: Icon; what: string }[] = [
  { slug: "system", label: "System", icon: Heartbeat, what: "Factory health in one place: whether the worker, database and AI services are up, how many builds are waiting, and when the last backup ran." },
  { slug: "agents", label: "Agents", icon: Robot, what: "Every part of the factory, what it is doing now and how often it succeeds, with a path from any stop to the exact check." },
  { slug: "memory", label: "Memory", icon: Brain, what: "What the factory has learned, facts that contradict each other, and old facts to review." },
  { slug: "business", label: "Business", icon: Briefcase, what: "Client self-editing, closing reports and care plans." },
];

/** Title of each route: the h1-level name, the document title and the phone header. `parent` gives the breadcrumb. */
const ROUTES: { re: RegExp; title: string; parent?: { label: string; to: string } }[] = [
  { re: /^\/$/, title: "Home" },
  { re: /^\/projects\/new/, title: "New request", parent: { label: "Projects", to: "/projects" } },
  { re: /^\/projects\/.+/, title: "Project", parent: { label: "Projects", to: "/projects" } },
  { re: /^\/clients\/.+/, title: "Project", parent: { label: "Projects", to: "/projects" } },
  { re: /^\/projects/, title: "Projects" },
  { re: /^\/decisions\/plans\//, title: "Proposal", parent: { label: "Projects", to: "/projects" } },
  { re: /^\/decisions\/accounts/, title: "Team and access" },
  { re: /^\/decisions/, title: "Decisions", parent: { label: "Home", to: "/" } },
  { re: /^\/activity\/fixes/, title: "Rounds of fixes", parent: { label: "Activity", to: "/activity" } },
  { re: /^\/activity\/.+/, title: "Build", parent: { label: "Activity", to: "/activity" } },
  { re: /^\/activity/, title: "Activity" },
  { re: /^\/costs/, title: "Costs" },
  { re: /^\/team/, title: "Team and access" },
  { re: /^\/notifications/, title: "Notifications" },
  { re: /^\/settings/, title: "Settings" },
  { re: /^\/more/, title: "More" },
];

function routeFor(pathname: string) {
  if (pathname.startsWith("/soon/")) {
    const room = COMING.find((c) => `/soon/${c.slug}` === pathname);
    return { title: room?.label ?? "Coming later" };
  }
  return ROUTES.find((r) => r.re.test(pathname)) ?? { title: "Cockpit" };
}

interface NavEntry {
  to: string;
  label: string;
  icon: Icon;
  end?: boolean;
  count?: number;
  /** Other paths that belong to this room (the design keeps Projects lit on a project, a proposal, a build). */
  also?: RegExp;
}

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);
}

export const SHORTCUTS: [string, string][] = [
  ["⌘ K", "Search or run a command"],
  ["/", "Search"],
  ["G then H", "Go home"],
  ["G then P", "Go to projects"],
  ["G then A", "Go to activity"],
  ["G then C", "Go to costs"],
  ["N", "New request"],
  ["D", "Switch Simple or Detailed"],
  ["?", "Show these shortcuts"],
  ["Esc", "Close a panel"],
];

function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);
  return (
    <dialog ref={ref} className="dialog sheet" aria-labelledby="keys-h" onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="sheet-head">
        <h2 id="keys-h">Keyboard shortcuts</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>
      <dl className="keys">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k}>
            <dt>
              <kbd className="kbd">{k}</kbd>
            </dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const me = useMe();
  const { attention, clients, jobs } = useFactory();
  const { unread } = useNotifications();
  const { detail, detailed, setDetail, toggle } = useDetail();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const decider = canDecide(me.role);
  const owner = me.role === "owner";
  const route = routeFor(pathname);
  const mainRef = useRef<HTMLElement>(null);
  const [palette, setPalette] = useState(false);
  const [keys, setKeys] = useState(false);

  // One title per screen, and focus moves to the content on navigation so screen readers hear the new page.
  const first = useRef(true);
  useEffect(() => {
    document.title = `${route.title} · WFACT Cockpit`;
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname, route.title]);

  // Focus is never left on <body>. A control disabled while it saves loses focus (the browser moves it off a moment
  // later); a control removed when the screen re-renders loses it too (Upload, Answer, Approve). Focus goes back to the
  // control once it can take it again, or to the content if it is gone. A pointer press is a deliberate move: forget it.
  useEffect(() => {
    let last: HTMLElement | null = null;
    const check = () => {
      const a = document.activeElement;
      if ((a && a !== document.body) || !last || last === mainRef.current) return;
      if (!last.isConnected || last.closest("dialog:not([open])")) {
        last = null;
        mainRef.current?.focus({ preventScroll: true });
      } else if (!(last as HTMLButtonElement).disabled) {
        last.focus({ preventScroll: true });
      }
    };
    const onIn = (e: FocusEvent) => {
      last = e.target as HTMLElement;
    };
    const onDown = () => {
      last = null;
    };
    const mo = new MutationObserver(() => {
      check();
      requestAnimationFrame(check);
    });
    document.addEventListener("focusin", onIn);
    document.addEventListener("pointerdown", onDown, true);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled", "open"] });
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("pointerdown", onDown, true);
      mo.disconnect();
    };
  }, []);

  const go = (to: string) => navigate(to);

  // Global keys. Single letters never fire while typing; ⌘K / Ctrl+K always does.
  useEffect(() => {
    let gAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector("dialog[open]")) return;
      const k = e.key.toLowerCase();
      if (gAt && Date.now() - gAt < 1500) {
        gAt = 0;
        const to = { h: "/", p: "/projects", a: decider ? "/activity" : null, c: owner ? "/costs" : null }[k];
        if (to) {
          e.preventDefault();
          navigate(to);
        }
        return;
      }
      if (k === "g") gAt = Date.now();
      else if (e.key === "/") {
        e.preventDefault();
        setPalette(true);
      } else if (k === "n" && decider) {
        e.preventDefault();
        navigate("/projects/new");
      } else if (k === "d") {
        e.preventDefault();
        toggle();
      } else if (e.key === "?") {
        e.preventDefault();
        setKeys(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [decider, owner, navigate, toggle]);

  const nav: NavEntry[] = [
    { to: "/", label: "Home", icon: House, end: true, count: attention.length },
    { to: "/projects", label: "Projects", icon: SquaresFour, also: /^\/(projects|clients|decisions\/plans)/ },
    ...(decider ? [{ to: "/activity", label: "Activity", icon: ListBullets }] : []),
    ...(owner ? [{ to: "/costs", label: "Costs", icon: Coins }] : []),
    ...(decider ? [{ to: "/team", label: "Team", icon: UsersThree, also: /^\/decisions\/accounts/ }] : []),
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/settings", label: "Settings", icon: GearSix },
  ];
  const current = (n: NavEntry) => (n.end ? pathname === n.to : pathname.startsWith(n.to) || !!n.also?.test(pathname));

  // The palette: real clients (latest proposal per client), actions, rooms and settings.
  const items = useMemo<PaletteItem[]>(() => {
    const running = (jobs ?? []).find((j) => isActive(j) && (j.kind === "build_plan" || j.kind === "resume"));
    const dark = isDark(readAppearance().theme);
    const list: PaletteItem[] = [
      ...(clients ?? []).map((c) => ({ id: `c-${c.key}`, group: "Clients" as const, label: c.name, hint: c.path ? `${STEP_NAMES[c.path.step]} · ${c.path.clientNext}` : undefined, icon: Storefront, run: () => go(c.path?.nextAction.href ?? c.href) })),
      ...(decider ? [{ id: "a-new", group: "Actions" as const, label: "New request", hint: "N", icon: Plus, run: () => go("/projects/new") }] : []),
      ...(decider
        ? [{
            id: "a-ask",
            group: "Actions" as const,
            label: "Ask the factory a question",
            hint: "Answered in plain words in Activity",
            icon: ChatCircleText,
            keywords: "question help",
            always: true,
            run: async (q: string) => {
              const question = q.trim();
              if (!question || /^ask( the factory)?( a question)?$/i.test(question)) {
                toast("Type your question in the search box, then choose “Ask the factory a question”.");
                return;
              }
              const { jobId, error } = await requestJob("ask", { question });
              if (error && !jobId) return toast(`Your question wasn't sent: ${error}`);
              toast("Question sent. The answer appears in Activity, usually within a minute.");
              if (jobId) go(`/activity/${jobId}`);
            },
          }]
        : []),
      { id: "a-detail", group: "Actions", label: `Switch to ${detailed ? "Simple" : "Detailed"}`, hint: "D", icon: SlidersHorizontal, run: () => toggle() },
      ...(running ? [{ id: "a-watch", group: "Actions" as const, label: "Watch the running build", icon: PlayCircle, run: () => go(`/activity/${running.id}`) }] : []),
      {
        id: "a-theme",
        group: "Actions",
        label: `Switch to ${dark ? "light" : "dark"} appearance`,
        icon: dark ? Sun : Moon,
        run: () => {
          const a = { ...readAppearance(), theme: dark ? ("light" as const) : ("dark" as const) };
          saveAppearance(a);
          applyAppearance(a);
        },
      },
      { id: "g-home", group: "Go to", label: "Home", hint: "G then H", icon: House, run: () => go("/") },
      { id: "g-projects", group: "Go to", label: "Projects", hint: "G then P", icon: SquaresFour, run: () => go("/projects") },
      ...(decider ? [{ id: "g-activity", group: "Go to" as const, label: "Activity", hint: "G then A", icon: ListBullets, run: () => go("/activity") }] : []),
      ...(owner ? [{ id: "g-costs", group: "Go to" as const, label: "Costs", hint: "G then C", icon: Coins, run: () => go("/costs") }] : []),
      { id: "g-notifications", group: "Go to", label: "Notifications", icon: Bell, run: () => go("/notifications") },
      { id: "s-settings", group: "Settings", label: "Appearance and settings", icon: GearSix, run: () => go("/settings") },
      { id: "s-keys", group: "Settings", label: "Keyboard shortcuts", hint: "?", icon: Keyboard, run: () => setKeys(true) },
    ];
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, jobs, decider, owner, detailed, toggle]);

  const bellLabel = unread.length ? `Notifications, ${unread.length} unread` : "Notifications";
  const initial = (me.fullName ?? me.email ?? "?").trim().charAt(0).toUpperCase();
  const roleWord = me.role ? `${me.role[0]!.toUpperCase()}${me.role.slice(1)}` : "No role yet";

  const tabs: NavEntry[] = [
    { to: "/", label: "Home", icon: House, end: true, count: attention.length },
    { to: "/projects", label: "Projects", icon: SquaresFour, also: /^\/(projects(?!\/new)|decisions\/plans)/ },
    ...(decider ? [{ to: "/projects/new", label: "New", icon: Plus }] : []),
    ...(decider ? [{ to: "/activity", label: "Activity", icon: ListBullets }] : []),
    { to: "/more", label: "More", icon: DotsThreeOutline, also: /^\/(more|costs|team|settings|notifications|soon|decisions\/accounts)/ },
  ];
  const tabCurrent = (t: NavEntry) => (t.end ? pathname === t.to : t.to === "/projects" ? !!t.also?.test(pathname) : pathname.startsWith(t.to) || !!t.also?.test(pathname));

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="shell">
        <aside className="rail" aria-label="Main">
          <Link to="/" className="rail-mark" aria-label="WFACT Cockpit, Home">
            <Wordmark />
          </Link>
          <nav className="nav" aria-label="Main navigation">
            {nav.map((n) => {
              const on = current(n);
              return (
                <NavLink key={n.to} to={n.to} end={n.end} aria-current={on ? "page" : undefined} className={on ? "on" : undefined}>
                  <n.icon aria-hidden="true" weight={on ? "fill" : "regular"} />
                  <span className="nav-label">{n.label}</span>{" "}
                  {!!n.count && (
                    <span className="count">
                      {n.count}{" "}
                      <span className="sr-only">waiting</span>
                    </span>
                  )}
                </NavLink>
              );
            })}
            <p className="nav-group" id="soon-label">
              Coming later
            </p>
            {COMING.map((c) => (
              <NavLink key={c.slug} to={`/soon/${c.slug}`} className="soon" aria-describedby="soon-label">
                <c.icon aria-hidden="true" />
                {c.label}
              </NavLink>
            ))}
          </nav>
          <div className="rail-foot">
            <Segmented label="Detail level" value={detail} onChange={setDetail} options={[{ value: "simple", label: "Simple" }, { value: "detailed", label: "Detailed" }]} />
            <Link to="/settings" className="who">
              <span className="who-initial" aria-hidden="true">
                {initial}
              </span>
              <span>
                <b>{me.fullName ?? me.email}</b>
                <small>{roleWord}</small>
              </span>
            </Link>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <nav className="crumbs" aria-label="Breadcrumb">
              {"parent" in route && route.parent && (
                <>
                  <Link to={route.parent.to}>{route.parent.label}</Link>
                  <span aria-hidden="true">/</span>
                </>
              )}
              <span aria-current="page">{route.title}</span>
            </nav>
            <span className="spacer" />
            <button type="button" className="search" aria-label="Search or run a command" aria-keyshortcuts="Meta+K Control+K" onClick={() => setPalette(true)}>
              <MagnifyingGlass aria-hidden="true" />
              <span className="search-text">Search or run a command</span>
              <kbd className="kbd" aria-hidden="true">
                ⌘K
              </kbd>
            </button>
            <Link to="/notifications" className="bell" aria-label={bellLabel}>
              <Bell aria-hidden="true" />
              {unread.length > 0 && <span className="dot" aria-hidden="true" />}
            </Link>
            {decider && (
              <Link className="btn primary" to="/projects/new">
                <Plus aria-hidden="true" />
                New request
              </Link>
            )}
          </header>
          <header className="phonebar">
            {"parent" in route && route.parent && (
              <Link to={route.parent.to} className="icon-btn back" aria-label={`Back to ${route.parent.label}`}>
                <CaretLeft aria-hidden="true" />
              </Link>
            )}
            <span className="phonebar-title">{route.title}</span>
            <button type="button" className="icon-btn" aria-label="Search or run a command" onClick={() => setPalette(true)}>
              <MagnifyingGlass aria-hidden="true" />
            </button>
            <Link to="/notifications" className="icon-btn bell-phone" aria-label={bellLabel}>
              <Bell aria-hidden="true" />
              {unread.length > 0 && <span className="dot" aria-hidden="true" />}
            </Link>
          </header>
          <main id="main" className="page" ref={mainRef} tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <nav className="tabbar" aria-label="Phone navigation" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => {
          const on = tabCurrent(t);
          const isNew = t.to === "/projects/new";
          return (
            <Link key={t.to} to={t.to} aria-current={on ? "page" : undefined} className={isNew ? "tab-new" : undefined}>
              <span className="tab-icon">
                <t.icon aria-hidden="true" weight={on ? "fill" : "regular"} />
                {!!t.count && (
                  <span className="count">
                    {t.count}{" "}
                    <span className="sr-only">waiting</span>
                  </span>
                )}
              </span>{" "}
              {t.label}
            </Link>
          );
        })}
      </nav>
      <CommandPalette open={palette} onClose={() => setPalette(false)} items={items} />
      <ShortcutsSheet open={keys} onClose={() => setKeys(false)} />
    </>
  );
}
