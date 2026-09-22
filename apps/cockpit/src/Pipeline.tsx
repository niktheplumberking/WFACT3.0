/** Room 1: Pipeline — every project, its client/entity, current stage and status. Read-only. */
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

interface ProjectRow {
  id: string;
  name: string;
  stage: string;
  status: string;
  created_at: string;
  clients: { name: string; entities: { name: string } | null } | null;
}

export function Pipeline() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("projects")
      .select("id,name,stage,status,created_at,clients(name,entities(name))")
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setProjects(data as unknown as ProjectRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p style={{ color: "crimson" }}>Error loading projects: {error}</p>;
  if (!projects) return <p>Loading…</p>;
  if (projects.length === 0) return <p>No projects yet.</p>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
          <th style={{ padding: "0.5rem" }}>Project</th>
          <th style={{ padding: "0.5rem" }}>Client</th>
          <th style={{ padding: "0.5rem" }}>Entity</th>
          <th style={{ padding: "0.5rem" }}>Stage</th>
          <th style={{ padding: "0.5rem" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((p) => (
          <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: "0.5rem" }}>{p.name}</td>
            <td style={{ padding: "0.5rem" }}>{p.clients?.name ?? "—"}</td>
            <td style={{ padding: "0.5rem" }}>{p.clients?.entities?.name ?? "—"}</td>
            <td style={{ padding: "0.5rem" }}>
              <code>{p.stage}</code>
            </td>
            <td style={{ padding: "0.5rem" }}>{p.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
