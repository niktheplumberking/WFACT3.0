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

  if (error) return <p className="error-state">Error loading projects: {error}</p>;
  if (!projects) return <p className="loading-state">Loading…</p>;
  if (projects.length === 0) return <p className="empty-state">No projects yet.</p>;

  return (
    <div className="panel">
      <table className="data-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Client</th>
            <th>Entity</th>
            <th>Stage</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.clients?.name ?? "—"}</td>
              <td>{p.clients?.entities?.name ?? "—"}</td>
              <td>
                <code>{p.stage}</code>
              </td>
              <td>
                <span className={`pill${p.status === "active" ? " status-active" : " status-default"}`}>
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
