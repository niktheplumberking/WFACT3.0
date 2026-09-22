/** Room 3: Runs — recent correction rounds (the honest build-quality metric the whole sprint exists
 * to measure) and recent tasks, most recent first. Read-only. */
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

interface RoundRow {
  id: string;
  round_number: number;
  stage: string;
  flagged_by: string;
  issue: string;
  fixed_by: string | null;
  created_at: string;
  projects: { name: string } | null;
}

export function Runs() {
  const [rounds, setRounds] = useState<RoundRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("correction_rounds")
      .select("id,round_number,stage,flagged_by,issue,fixed_by,created_at,projects(name)")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setRounds(data as unknown as RoundRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p style={{ color: "crimson" }}>Error loading runs: {error}</p>;
  if (!rounds) return <p>Loading…</p>;
  if (rounds.length === 0) return <p>No runs logged yet.</p>;

  return (
    <div>
      {rounds.map((r) => (
        <div key={r.id} style={{ borderBottom: "1px solid #eee", padding: "0.75rem 0" }}>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>
            {r.projects?.name ?? "—"} · round {r.round_number} · <code>{r.stage}</code> ·{" "}
            {new Date(r.created_at).toLocaleString()}
          </div>
          <div>{r.issue}</div>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>
            flagged by {r.flagged_by}
            {r.fixed_by ? ` · fixed by ${r.fixed_by}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
