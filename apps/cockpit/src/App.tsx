import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { Login } from "./Login";
import { Pipeline } from "./Pipeline";
import { Approvals } from "./Approvals";
import { Runs } from "./Runs";

type Room = "pipeline" | "approvals" | "runs";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [room, setRoom] = useState<Room>("pipeline");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null; // resolving initial session, avoid a login flash
  if (session === null) return <Login />;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.25rem" }}>WFACT Cockpit</h1>
        <button onClick={() => supabase.auth.signOut()} style={{ padding: "0.35rem 0.8rem" }}>
          Sign out ({session.user.email})
        </button>
      </header>

      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {(["pipeline", "approvals", "runs"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRoom(r)}
            style={{
              padding: "0.5rem 1rem",
              fontWeight: room === r ? 700 : 400,
              borderBottom: room === r ? "2px solid #222" : "2px solid transparent",
              background: "none",
              cursor: "pointer",
            }}
          >
            {r[0]!.toUpperCase() + r.slice(1)}
          </button>
        ))}
      </nav>

      {room === "pipeline" && <Pipeline />}
      {room === "approvals" && <Approvals />}
      {room === "runs" && <Runs />}
    </div>
  );
}
