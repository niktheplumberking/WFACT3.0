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

  if (error) return <p className="error-state">Error loading runs: {error}</p>;
  if (!rounds) return <p className="loading-state">Loading…</p>;
  if (rounds.length === 0) return <p className="empty-state">No runs logged yet.</p>;

  return (
    <div className="panel">
      {rounds.map((r) => (
        <div key={r.id} className="run-item">
          <div className="run-meta">
            {r.projects?.name ?? "—"} · round {r.round_number} · <span className="stage-tag">{r.stage}</span> ·{" "}
            {new Date(r.created_at).toLocaleString()}
          </div>
          <div className="run-issue">{r.issue}</div>
          <div className="run-footer">
            flagged by {r.flagged_by}
            {r.fixed_by ? ` · fixed by ${r.fixed_by}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
