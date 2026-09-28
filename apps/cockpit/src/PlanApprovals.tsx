/**
 * Plan approvals — Continuation Plan Stage 4, Blueprint §5 Planning ("Owner approves the plan").
 * Extends the existing Approvals room rather than adding a new one. Everything that matters is
 * enforced by the database, not this component (packages/db/migrations/0007_plan_approvals.sql):
 * RLS lets only owner/admin read or decide; the trigger allows exactly one decision per plan, stamps
 * decided_by/decided_at from the session, refuses any edit to the plan itself, requires a note on
 * rejection, and writes an audit_log row. This UI only collects the decision.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

interface PlanTask {
  order: number;
  role: string;
  stage: string;
  title: string;
}

interface PlanBody {
  plan: {
    templateId: string;
    templateRationale: string;
    brief: { projectName: string; goal: string; brandNotes: string; requiredSections: string[] };
    tasks: PlanTask[];
    risks: string[];
    openQuestions: string[];
    intake: { entitySlug: string; leadType: string; clientName: string; requestSource: string };
  };
}

interface PlanRow {
  id: string;
  created_at: string;
  client_slug: string;
  entity_slug: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  revision: number;
  decision_note: string | null;
  plan: PlanBody;
}

export function PlanApprovals() {
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    const { data, error: fetchError } = await supabase
      .from("plan_approvals")
      .select("id,created_at,client_slug,entity_slug,status,revision,decision_note,plan")
      .in("status", ["pending", "approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (fetchError) setError(fetchError.message);
    else setRows(data as PlanRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(row: PlanRow, status: "approved" | "rejected") {
    const note = (notes[row.id] ?? "").trim();
    if (status === "rejected" && !note) {
      setError("Add a note before rejecting — the Planner re-plans from it.");
      return;
    }
    setBusyId(row.id);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("plan_approvals")
      .update({ status, decision_note: note || null })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    setBusyId(null);
    if (updateError) {
      setError(`Could not record the decision: ${updateError.message}`);
      return;
    }
    if (!data || data.length === 0) {
      // RLS filtered it out (not owner/admin) or someone else decided first — never pretend it worked.
      setError("Decision not recorded — this plan is no longer pending, or your role can't decide plans.");
      return;
    }
    await load();
  }

  if (!rows) return <p className="loading-state">Loading plans…</p>;
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending").slice(0, 5);

  return (
    <section className="plan-approvals">
      <h2 className="section-title">Plans awaiting your approval</h2>
      {error && <p className="error-state">{error}</p>}
      {pending.length === 0 && <p className="empty-state">No plans waiting. New ones arrive from Intake → Planner.</p>}
      {pending.map((row) => {
        const p = row.plan.plan;
        return (
          <article key={row.id} className="panel plan-card">
            <header className="plan-head">
              <div>
                <h3 className="plan-title">{p.brief.projectName}</h3>
                <p className="plan-meta">
                  {p.intake.clientName} · entity <code>{row.entity_slug}</code> · {p.intake.leadType.replace(/_/g, " ")} ·
                  template <code>{p.templateId}</code>
                  {row.revision > 1 && <span className="pill status-default">re-plan</span>}
                </p>
              </div>
            </header>
            <p className="plan-goal">{p.brief.goal}</p>
            <p className="plan-sub">Why this template: {p.templateRationale}</p>
            <p className="plan-sub">Sections: {p.brief.requiredSections.join(", ")}</p>
            <ol className="plan-tasks">
              {p.tasks.map((t) => (
                <li key={t.order}>
                  <code>{t.role}</code> — {t.title}
                </li>
              ))}
            </ol>
            {p.openQuestions.length > 0 && (
              <details className="plan-questions">
                <summary>{p.openQuestions.length} open question(s) to consider first</summary>
                <ul>{p.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
              </details>
            )}
            {p.risks.length > 0 && <p className="plan-sub">Risks: {p.risks.join(" · ")}</p>}
            <div className="plan-actions">
              <input
                className="plan-note"
                placeholder="Note (required to reject — the Planner re-plans from it)"
                value={notes[row.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
              />
              <button className="btn" disabled={busyId === row.id} onClick={() => decide(row, "rejected")}>
                Reject
              </button>
              <button className="btn primary" disabled={busyId === row.id} onClick={() => decide(row, "approved")}>
                {busyId === row.id ? "Saving…" : "Approve plan"}
              </button>
            </div>
          </article>
        );
      })}
      {decided.length > 0 && (
        <p className="plan-sub">
          Recently decided:{" "}
          {decided.map((r) => `${r.plan.plan.brief.projectName} (${r.status})`).join(" · ")}
        </p>
      )}
    </section>
  );
}
