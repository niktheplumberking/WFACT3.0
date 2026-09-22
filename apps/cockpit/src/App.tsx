import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { Login } from "./Login";
import { Pipeline } from "./Pipeline";
import { Approvals } from "./Approvals";
import { Runs } from "./Runs";

type Room = "pipeline" | "approvals" | "runs";

const ROOMS: { id: Room; label: string; hint: string }[] = [
  { id: "pipeline", label: "Pipeline", hint: "Every project, by stage" },
  { id: "approvals", label: "Approvals", hint: "Gates waiting on a decision" },
  { id: "runs", label: "Runs", hint: "Correction rounds, logged" },
];

interface Stats {
  projects: number | null;
  active: number | null;
  corrections: number | null;
}

function useStats(): Stats {
  const [stats, setStats] = useState<Stats>({ projects: null, active: null, corrections: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [projectsRes, activeRes, correctionsRes] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("correction_rounds").select("id", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      setStats({
        projects: projectsRes.count ?? null,
        active: activeRes.count ?? null,
        corrections: correctionsRes.count ?? null,
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [room, setRoom] = useState<Room>("pipeline");
  const stats = useStats();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (session === null) return <Login />;

  const activeRoom = ROOMS.find((r) => r.id === room)!;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-mark">
          <span className="sidebar-mark-dot" />
          <span className="sidebar-mark-text">WFACT</span>
        </div>

        <nav className="sidebar-nav">
          {ROOMS.map((r) => (
            <button
              key={r.id}
              className={`nav-item${room === r.id ? " active" : ""}`}
              onClick={() => setRoom(r.id)}
            >
              <span className="nav-item-label">{r.label}</span>
              <span className="nav-item-hint">{r.hint}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">Cockpit v3</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1 className="topbar-title">{activeRoom.label}</h1>
            <p className="topbar-hint">{activeRoom.hint}</p>
          </div>
          <button className="btn" onClick={() => supabase.auth.signOut()}>
            Sign out · {session.user.email}
          </button>
        </header>

        <section className="stat-strip">
          <div className="stat-tile stat-amber">
            <span className="stat-value">{stats.projects ?? "—"}</span>
            <span className="stat-label">Projects</span>
          </div>
          <div className="stat-tile stat-green">
            <span className="stat-value">{stats.active ?? "—"}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-tile stat-cyan">
            <span className="stat-value">{stats.corrections ?? "—"}</span>
            <span className="stat-label">Correction rounds logged</span>
          </div>
        </section>

        <section className="room-content">
          {room === "pipeline" && <Pipeline />}
          {room === "approvals" && <Approvals />}
          {room === "runs" && <Runs />}
        </section>
      </main>
    </div>
  );
}
