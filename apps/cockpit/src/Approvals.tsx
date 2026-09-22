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

  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!projects) return <p>Loading…</p>;
  if (projects.length === 0) return <p>No projects to approve.</p>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
          <th style={{ padding: "0.5rem" }}>Project</th>
          <th style={{ padding: "0.5rem" }}>Current stage</th>
          <th style={{ padding: "0.5rem" }}>Next stage</th>
          <th style={{ padding: "0.5rem" }}></th>
        </tr>
      </thead>
      <tbody>
        {projects.map((p) => {
          const next = nextStage(p.stage);
          return (
            <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.5rem" }}>{p.name}</td>
              <td style={{ padding: "0.5rem" }}>
                <code>{p.stage}</code>
              </td>
              <td style={{ padding: "0.5rem" }}>{next ? <code>{next}</code> : "— final stage —"}</td>
              <td style={{ padding: "0.5rem" }}>
                <button
                  disabled={!next || busyId === p.id}
                  onClick={() => approve(p)}
                  style={{ padding: "0.35rem 0.8rem" }}
                >
                  {busyId === p.id ? "Approving…" : "Approve → next stage"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
