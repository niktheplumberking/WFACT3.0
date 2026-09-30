/**
 * Room 2: Approvals — a human advances a project to its next pipeline stage. Per the Fast-Track
 * Plan's exit check wording ("a project can be moved through its stages and a gate can be
 * approved"), advancing the stage *is* the gate approval for this MVP — there's no separate
 * approvals table in the schema, and building one wasn't asked for (confirmed with Huraira,
 * 2026-09-22). The write itself is gated by RLS's projects_owner_update policy
 * (packages/db/migrations/0003/0005) — only owner/admin roles can call this successfully; a pm
 * role gets a real RLS rejection from Supabase, not a client-side-only restriction.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { nextStage } from "./stages";
// Stage 4 (2026-09-28): the room now also holds the Planner's owner-approval gate (plan_approvals,
// migration 0007) — the "separate approvals table" this header said wasn't needed yet is now needed.
import { PlanApprovals } from "./PlanApprovals";
// 2026-09-30 (migration 0010): owners/admins also review new account sign-ups here.
import { AccessRequests } from "./AccessRequests";

interface ProjectRow {
  id: string;
  name: string;
  stage: string;
}

export function Approvals() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data, error: fetchError } = await supabase
      .from("projects")
      .select("id,name,stage")
      .order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setProjects(data as ProjectRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(p: ProjectRow) {
    const next = nextStage(p.stage);
    if (!next) return;
    setBusyId(p.id);
    setError(null);
    const { error: updateError } = await supabase
      .from("projects")
      .update({ stage: next })
      .eq("id", p.id);
    setBusyId(null);
    if (updateError) {
      setError(`Could not advance "${p.name}": ${updateError.message}`);
      return;
    }
    await load();
  }

  if (!projects) return <p className="loading-state">Loading…</p>;

  return (
    <div>
      <AccessRequests />
      <PlanApprovals />
      <h2 className="section-title">Stage gates</h2>
      {error && <p className="error-state">{error}</p>}
      {projects.length === 0 && <p className="empty-state">No projects to approve.</p>}
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Current stage</th>
              <th>Next stage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const next = nextStage(p.stage);
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <code>{p.stage}</code>
                  </td>
                  <td>{next ? <code>{next}</code> : "— final stage —"}</td>
                  <td>
                    <button
                      className="btn primary"
                      disabled={!next || busyId === p.id}
                      onClick={() => approve(p)}
                    >
                      {busyId === p.id ? "Approving…" : "Approve → next stage"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
