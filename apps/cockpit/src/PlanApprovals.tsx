/**
 * Plan approvals — Continuation Plan Stage 4, Blueprint §5 Planning ("Owner approves the plan").
 * Extends the existing Approvals room rather than adding a new one. Everything that matters is
 * enforced by the database, not this component (packages/db/migrations/0007_plan_approvals.sql):
 * RLS lets only owner/admin read or decide; the trigger allows exactly one decision per plan, stamps
 * decided_by/decided_at from the session, refuses any edit to the plan itself, requires a note on
 * rejection, and writes an audit_log row. This UI only collects the decision.
 *
 * Step 4B M2 (migration 0011): each card shows the direction summary (niche, goal, audience, brand
 * direction with the client's own words) and the recommended build track with its reasons. The owner
 * picks Track A or B (pre-selected to the recommendation when there is one); an approval without a track
 * is refused by the database, which also computes and audits whether the choice overrode the recommendation.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

type Track = "A" | "B";

interface PlanTask {
  order: number;
  role: string;
  stage: string;
  title: string;
}

interface Quoted {
  point: string;
  quote: string;
}

interface Direction {
  taxonomyVersion: string;
  niche: string;
  nicheLabel: string;
  nicheQuote: string | null;
  audience: Quoted | null;
  primaryGoal: string;
  goalQuote: string | null;
  requirements: Quoted[];
  constraints: Quoted[];
  brandDirection: (Quoted & { aspect: string })[];
  recommendation: { track: Track | null; confidence: number; reasons: string[]; withheldReason: string | null };
  openQuestions: string[];
  unsupported: string[];
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
  direction?: Direction | null;
  directionNote?: string | null;
}

interface PlanRow {
  id: string;
  created_at: string;
  client_slug: string;
  entity_slug: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  revision: number;
  decision_note: string | null;
  build_track: Track | null;
  track_overridden: boolean | null;
  plan: PlanBody;
}

const TRACKS: { id: Track; name: string; summary: string }[] = [
  { id: "A", name: "Track A · Local business", summary: "Multi-page, fast on weak signal, click-to-call and quote forms." },
  { id: "B", name: "Track B · Motion-rich brand", summary: "Next.js static site with scroll-driven motion and rich sections." },
];

const GOAL_LABEL: Record<string, string> = {
  call: "phone calls",
  booking: "bookings",
  quote_form: "quote requests",
  purchase: "purchases",
  enquiry: "enquiries",
  portfolio_view: "portfolio views",
  other: "other",
};

function Said({ quote }: { quote: string | null | undefined }) {
  if (!quote) return null;
  return <q className="said">{quote}</q>;
}

function DirectionSummary({ d, note }: { d: Direction | null | undefined; note: string | null | undefined }) {
  if (!d) {
    return (
      <div className="direction direction-missing">
        <p className="plan-sub">No direction summary for this plan{note ? `: ${note}` : " (created before the direction step existed)"}.</p>
      </div>
    );
  }
  return (
    <div className="direction">
      <dl className="direction-facts">
        <div>
          <dt>Niche</dt>
          <dd>
            {d.nicheLabel} <Said quote={d.nicheQuote} />
          </dd>
        </div>
        <div>
          <dt>Main goal</dt>
          <dd>
            More {GOAL_LABEL[d.primaryGoal] ?? d.primaryGoal} <Said quote={d.goalQuote} />
          </dd>
        </div>
        {d.audience && (
          <div>
            <dt>Audience</dt>
            <dd>
              {d.audience.point} <Said quote={d.audience.quote} />
            </dd>
          </div>
        )}
      </dl>
      {d.brandDirection.length > 0 && (
        <ul className="direction-brand" aria-label="Brand direction">
          {d.brandDirection.map((b, i) => (
            <li key={i}>
              <span className="direction-aspect">{b.aspect}</span> {b.point} <Said quote={b.quote} />
            </li>
          ))}
        </ul>
      )}
      {(d.requirements.length > 0 || d.constraints.length > 0) && (
        <details className="plan-questions">
          <summary>
            {d.requirements.length} requirement(s), {d.constraints.length} constraint(s)
          </summary>
          <ul>
            {[...d.requirements, ...d.constraints].map((x, i) => (
              <li key={i}>
                {x.point} <Said quote={x.quote} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {d.unsupported.length > 0 && (
        <details className="plan-questions">
          <summary>{d.unsupported.length} point(s) dropped: not found in the client's words</summary>
          <ul>{d.unsupported.map((u, i) => <li key={i}>{u}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export function PlanApprovals() {
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [tracks, setTracks] = useState<Record<string, Track | undefined>>({});

  async function load() {
    const { data, error: fetchError } = await supabase
      .from("plan_approvals")
      .select("id,created_at,client_slug,entity_slug,status,revision,decision_note,build_track,track_overridden,plan")
      .in("status", ["pending", "approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (fetchError) setError(fetchError.message);
    else setRows(data as PlanRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  const chosen = (row: PlanRow): Track | undefined => tracks[row.id] ?? row.plan.direction?.recommendation.track ?? undefined;

  async function decide(row: PlanRow, status: "approved" | "rejected") {
    const note = (notes[row.id] ?? "").trim();
    const track = chosen(row);
    if (status === "rejected" && !note) {
      setError("Add a note before rejecting — the Planner re-plans from it.");
      return;
    }
    if (status === "approved" && !track) {
      setError("Choose Track A or Track B before approving.");
      return;
    }
    setBusyId(row.id);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("plan_approvals")
      .update(status === "approved" ? { status, decision_note: note || null, build_track: track } : { status, decision_note: note || null })
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
      {error && <p className="error-state" role="alert">{error}</p>}
      {pending.length === 0 && <p className="empty-state">No plans waiting. New ones arrive from Intake → Direction → Planner.</p>}
      {pending.map((row) => {
        const p = row.plan.plan;
        const d = row.plan.direction;
        const rec = d?.recommendation;
        const track = chosen(row);
        const overriding = Boolean(rec?.track && track && track !== rec.track);
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

            <div className="direction-layout">
              <DirectionSummary d={d} note={row.plan.directionNote} />

              <fieldset className="track-choice">
                <legend>Build track</legend>
                {rec?.track ? (
                  <p className="track-rec">
                    Recommended: <strong>Track {rec.track}</strong>, confidence {Math.round(rec.confidence * 100)}%
                  </p>
                ) : (
                  <p className="track-rec">
                    No recommendation{rec?.withheldReason ? `: ${rec.withheldReason}` : ""}. Choose the track yourself.
                  </p>
                )}
                {rec && rec.reasons.length > 0 && (
                  <ul className="track-reasons">
                    {rec.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
                {TRACKS.map((t) => (
                  <label key={t.id} className={`track-option${track === t.id ? " is-chosen" : ""}`}>
                    <input
                      type="radio"
                      name={`track-${row.id}`}
                      value={t.id}
                      checked={track === t.id}
                      onChange={() => setTracks({ ...tracks, [row.id]: t.id })}
                    />
                    <span>
                      <span className="track-name">
                        {t.name}
                        {rec?.track === t.id && <span className="pill status-active">recommended</span>}
                      </span>
                      <span className="track-summary">{t.summary}</span>
                    </span>
                  </label>
                ))}
                {overriding && <p className="track-override">You are choosing against the recommendation. That is recorded with the approval.</p>}
              </fieldset>
            </div>

            <p className="plan-sub">Why this template: {p.templateRationale}</p>
            <p className="plan-sub">Sections: {p.brief.requiredSections.join(", ")}</p>
            <ol className="plan-tasks">
              {p.tasks.map((t) => (
                <li key={t.order}>
                  <code>{t.role}</code> — {t.title}
                </li>
              ))}
            </ol>
            {(p.openQuestions.length > 0 || (d?.openQuestions.length ?? 0) > 0) && (
              <details className="plan-questions">
                <summary>{p.openQuestions.length + (d?.openQuestions.length ?? 0)} open question(s) to consider first</summary>
                <ul>{[...p.openQuestions, ...(d?.openQuestions ?? [])].map((q, i) => <li key={i}>{q}</li>)}</ul>
              </details>
            )}
            {p.risks.length > 0 && <p className="plan-sub">Risks: {p.risks.join(" · ")}</p>}
            <div className="plan-actions">
              <input
                className="plan-note"
                aria-label="Decision note"
                placeholder="Note (required to reject — the Planner re-plans from it)"
                value={notes[row.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
              />
              <button className="btn" disabled={busyId === row.id} onClick={() => decide(row, "rejected")}>
                Reject
              </button>
              <button className="btn primary" disabled={busyId === row.id || !track} onClick={() => decide(row, "approved")}>
                {busyId === row.id ? "Saving…" : track ? `Approve as Track ${track}` : "Choose a track to approve"}
              </button>
            </div>
          </article>
        );
      })}
      {decided.length > 0 && (
        <p className="plan-sub">
          Recently decided:{" "}
          {decided
            .map((r) => `${r.plan.plan.brief.projectName} (${r.status}${r.build_track ? `, Track ${r.build_track}${r.track_overridden ? ", overridden" : ""}` : ""})`)
            .join(" · ")}
        </p>
      )}
    </section>
  );
}
