/**
 * Decisions: plans (with the build-track choice), account requests and stage moves. Everything that
 * matters is enforced by the database, not here: plan_approvals' trigger (0007/0011) allows one decision,
 * requires a note to reject and a track to approve, and audits it; decide_account_request() (0010) checks
 * the caller's role; projects updates are owner/admin by RLS. This UI collects decisions and says plainly
 * what each one does and doesn't do. Launch is never moved from here (Step 4C decision D3).
 */
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { Check, ArrowRight, ArrowClockwise } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { isActive, requestJob } from "../jobsClient";
import { planIdOfJob } from "../lib/attention";
import {
  GOAL_LABEL, KIND_LABEL, LEAD_LABEL, TRACKS, dateTime, jobState, planName, shortDate,
  type AccountRequestRow, type Direction, type PlanRow, type ProjectRow, type Role, type Track,
} from "../lib/model";
import { canDecide, fetchPlan, useFactory, useLoad, useMe, useToast } from "../lib/state";
import { nextStage, stageLabel, stageMoveBlock } from "../stages";
import { Aspect, ConfirmDialog, Empty, LoadError, Loading, Notice, PageHead, Plate } from "../components/ui";
import { fetchProjects } from "./Home";

/* ---------------- tabs ---------------- */

function Tabs() {
  const { plans, accounts, attention } = useFactory();
  const me = useMe();
  const pendingPlans = plans?.filter((p) => p.status === "pending").length ?? 0;
  const pendingAccounts = accounts?.filter((a) => a.status === "pending" && a.user_id !== me.userId).length ?? 0;
  const launches = attention.filter((i) => i.kind === "launch").length;
  return (
    <nav className="tabs" aria-label="Decision types">
      <NavLink to="/decisions" end>
        Plans {pendingPlans + launches > 0 && <span className="count">{pendingPlans + launches}</span>}
      </NavLink>
      <NavLink to="/decisions/accounts">Accounts {pendingAccounts > 0 && <span className="count">{pendingAccounts}</span>}</NavLink>
      <NavLink to="/decisions/stages">Stage moves</NavLink>
    </nav>
  );
}

function Header() {
  return (
    <PageHead
      title="Decisions"
      lead="Everything waiting for a person. Each decision is recorded with your name and the time. Escalations and blocked tasks join this page in Step 14."
    />
  );
}

/* ---------------- plans list ---------------- */

export default function PlansTab() {
  const f = useFactory();
  const plans = f.plans;
  const pending = plans?.filter((p) => p.status === "pending") ?? [];
  const decided = plans?.filter((p) => p.status !== "pending").slice(0, 8) ?? [];
  const launches = f.attention.filter((i) => i.kind === "launch");
  return (
    <>
      <Header />
      <Tabs />
      <div className="stack">
        {f.error && <LoadError what="plans" error={f.error} onRetry={f.reload} />}
        <Plate title="Plans waiting for you">
          {!plans && !f.error && <Loading rows={2} label="Loading plans" />}
          {plans && pending.length === 0 && (
            <Empty title="No plans are waiting.">
              New plans arrive here after you start a request. <Link to="/projects/new">Start one</Link>
            </Empty>
          )}
          {pending.length > 0 && (
            <ul className="queue">
              {pending.map((p) => {
                const rec = p.plan.direction?.recommendation;
                return (
                  <li key={p.id}>
                    <span className="lamp caution" aria-hidden="true" />
                    <div>
                      <Link className="row-link what" to={`/decisions/plans/${p.id}`}>
                        {planName(p)}
                      </Link>
                      <p className="why">
                        {LEAD_LABEL[p.plan.plan.intake?.leadType] ?? "Request"}, {p.entity_slug}.{" "}
                        {rec?.track ? `Track ${rec.track} recommended (${Math.round(rec.confidence * 100)}% sure).` : "No track recommended."} Written {dateTime(p.created_at)}.
                        {p.revision > 1 ? " This is a re-plan." : ""}
                      </p>
                    </div>
                    <Aspect tone="caution">Your decision</Aspect>
                  </li>
                );
              })}
            </ul>
          )}
        </Plate>
        {launches.length > 0 && (
          <Plate title="Builds ready for a launch decision" note="Launch happens outside the Cockpit. Nothing here publishes a site.">
            <ul className="queue">
              {launches.map((i) => (
                <li key={i.key}>
                  <span className="lamp caution" aria-hidden="true" />
                  <div>
                    <Link className="row-link what" to={i.href}>
                      {i.title}
                    </Link>
                    <p className="why">{i.why}</p>
                  </div>
                  <Aspect tone="caution">Your decision</Aspect>
                </li>
              ))}
            </ul>
          </Plate>
        )}
        {decided.length > 0 && (
          <Plate title="Recently decided">
            <ul className="rows">
              {decided.map((p) => (
                <li key={p.id}>
                  <Aspect tone={p.status === "approved" ? "clear" : "stop"}>{p.status === "approved" ? "Approved" : "Rejected"}</Aspect>
                  <div>
                    <Link className="row-link what" to={`/decisions/plans/${p.id}`}>
                      {planName(p)}
                    </Link>
                    <p className="why">
                      {p.status === "approved"
                        ? p.build_track
                          ? `Track ${p.build_track}${p.track_overridden ? ", against the recommendation" : ""}.`
                          : "Approved before the track choice existed: needs a new plan."
                        : `Note: “${p.decision_note ?? ""}”`}
                    </p>
                  </div>
                  <span className="when fig">{shortDate(p.decided_at ?? p.created_at)}</span>
                </li>
              ))}
            </ul>
          </Plate>
        )}
      </div>
    </>
  );
}

/* ---------------- plan page ---------------- */

function Said({ quote }: { quote: string | null | undefined }) {
  return quote ? <span className="said">“{quote}”</span> : null;
}

function WhatTheClientWants({ p, d, note }: { p: PlanRow["plan"]["plan"]; d: Direction | null | undefined; note: string | null | undefined }) {
  return (
    <Plate title="What the client wants">
      <div className="plate-body stack-tight">
        <p className="lede">{p.brief.goal}</p>
        {!d && <Notice tone="info">No direction summary for this plan{note ? `: ${note}` : " (it was written before the direction step existed)"}.</Notice>}
        {d && (
          <dl className="facts">
            <div>
              <dt>Kind of business</dt>
              <dd>
                {d.nicheLabel}
                <Said quote={d.nicheQuote} />
              </dd>
            </div>
            <div>
              <dt>Main goal</dt>
              <dd>
                More {GOAL_LABEL[d.primaryGoal] ?? d.primaryGoal}
                <Said quote={d.goalQuote} />
              </dd>
            </div>
            {d.audience && (
              <div>
                <dt>Who visits</dt>
                <dd>
                  {d.audience.point}
                  <Said quote={d.audience.quote} />
                </dd>
              </div>
            )}
            {d.brandDirection.map((b, i) => (
              <div key={i}>
                <dt>{i === 0 ? "Look and feel" : <span className="sr-only">Look and feel</span>}</dt>
                <dd>
                  {b.point}
                  <Said quote={b.quote} />
                </dd>
              </div>
            ))}
          </dl>
        )}
        {d && (d.requirements.length > 0 || d.constraints.length > 0) && (
          <details className="raw">
            <summary>
              {d.requirements.length} requirements and {d.constraints.length} constraints from the client's words
            </summary>
            <ul className="plain" style={{ marginTop: 12 }}>
              {[...d.requirements, ...d.constraints].map((x, i) => (
                <li key={i}>
                  {x.point}
                  <Said quote={x.quote} />
                </li>
              ))}
            </ul>
          </details>
        )}
        {d && d.unsupported.length > 0 && (
          <details className="raw">
            <summary>{d.unsupported.length} points dropped because the client never said them</summary>
            <ul className="plain" style={{ marginTop: 12 }}>
              {d.unsupported.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Plate>
  );
}

function PlanDetails({ row }: { row: PlanRow }) {
  const p = row.plan.plan;
  const d = row.plan.direction;
  const questions = [...p.openQuestions, ...(d?.openQuestions ?? [])];
  const [allQ, setAllQ] = useState(false);
  return (
    <div className="stack">
      <WhatTheClientWants p={p} d={d} note={row.plan.directionNote} />
      {questions.length > 0 && (
        <Plate title="Settle these before building" note={`${allQ ? questions.length : Math.min(questions.length, 5)} of ${questions.length}`}>
          <div className="plate-body stack-tight">
            <ul className="plain">
              {(allQ ? questions : questions.slice(0, 5)).map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
            {questions.length > 5 && (
              <div>
                <button className="btn ghost small" type="button" aria-expanded={allQ} onClick={() => setAllQ(!allQ)}>
                  {allQ ? "Show fewer" : `Show ${questions.length - 5} more`}
                </button>
              </div>
            )}
          </div>
        </Plate>
      )}
      <Plate title="The plan">
        <div className="plate-body stack-tight">
          <dl className="facts">
            <div>
              <dt>Starting template</dt>
              <dd>
                {p.templateId}
                <span className="said" style={{ display: "block" }}>{p.templateRationale}</span>
              </dd>
            </div>
            <div>
              <dt>Sections</dt>
              <dd>{p.brief.requiredSections.join(", ")}</dd>
            </div>
            <div>
              <dt>Steps</dt>
              <dd>
                <ol className="plain" style={{ paddingLeft: 20 }}>
                  {p.tasks.map((t) => (
                    <li key={t.order}>{t.title}</li>
                  ))}
                </ol>
              </dd>
            </div>
          </dl>
          {p.risks.length > 0 && (
            <details className="raw">
              <summary>{p.risks.length} risks the planner flagged</summary>
              <ul className="plain" style={{ marginTop: 12 }}>
                {p.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </Plate>
    </div>
  );
}

function DecisionPanel({ row, onDone }: { row: PlanRow; onDone: () => void }) {
  const rec = row.plan.direction?.recommendation;
  const [track, setTrack] = useState<Track | undefined>(rec?.track ?? undefined);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const f = useFactory();
  const overriding = Boolean(rec?.track && track && track !== rec.track);

  async function decide(status: "approved" | "rejected") {
    const n = note.trim();
    if (status === "rejected" && !n) return setError("Write a note before rejecting: the planner writes the new plan from it.");
    if (status === "approved" && !track) return setError("Choose Track A or Track B before approving.");
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("plan_approvals")
      .update(status === "approved" ? { status, decision_note: n || null, build_track: track } : { status, decision_note: n || null })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    setBusy(false);
    if (e) return setError(`Your decision wasn't recorded: ${e.message}. Nothing changed; try again.`);
    if (!data || data.length === 0) {
      // RLS filtered it out (not owner/admin) or someone else decided first: never pretend it worked.
      return setError("Your decision wasn't recorded: this plan is no longer waiting, or your role can't decide plans. Reload to see its state.");
    }
    toast(status === "approved" ? `Plan approved as Track ${track}. Start the build when you're ready.` : "Plan rejected. You can re-plan it from your note.");
    await f.reload();
    onDone();
  }

  return (
    <section className="plate sticky" aria-labelledby="decide-h">
      <div className="plate-head">
        <h2 id="decide-h">Your decision</h2>
      </div>
      <form className="plate-body stack-tight" onSubmit={(e) => { e.preventDefault(); decide("approved"); }}>
        <fieldset className="tracks">
          <legend>How should it be built?</legend>
          {!rec?.track && <p className="muted" style={{ fontSize: "var(--t-sm)" }}>No recommendation{rec?.withheldReason ? `: ${rec.withheldReason}` : ""}. Choose the track yourself.</p>}
          {TRACKS.map((t) => (
            <div key={t.id} style={{ display: "grid", gap: 12 }}>
              <label className={`track${track === t.id ? " is-chosen" : ""}`}>
                <input type="radio" name={`track-${row.id}`} value={t.id} checked={track === t.id} onChange={() => setTrack(t.id)} />
                <span>
                  <b>{t.name}</b>
                  {rec?.track === t.id && (
                    <span className="aspect clear" style={{ marginLeft: 8 }}>
                      Recommended, {Math.round(rec.confidence * 100)}% sure
                    </span>
                  )}
                  <span className="muted">{t.summary}</span>
                </span>
              </label>
              {rec?.track === t.id && rec.reasons.length > 0 && (
                <details className="raw">
                  <summary>Why Track {t.id} is recommended ({rec.reasons.length} reasons)</summary>
                  <ul className="reasons" style={{ marginTop: 8 }}>
                    {rec.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
          {overriding && <Notice tone="caution">You're choosing against the recommendation. That is recorded with the approval.</Notice>}
        </fieldset>
        {/* Approve sits right under the choice it confirms; Reject sits with the note it needs. */}
        <div className="actions">
          <button className="btn go" type="submit" disabled={busy || !track}>
            <Check aria-hidden="true" />
            {busy ? "Saving…" : track ? `Approve as Track ${track}` : "Choose a track to approve"}
          </button>
        </div>
        <p className="quiet fine" style={{ marginTop: -8 }}>Recorded with your name and the time, and can't be changed afterwards. Approving doesn't build or publish anything: you start the build next.</p>
        {error && <Notice tone="stop">{error}</Notice>}
        <div className="field" style={{ borderTop: "1px solid var(--seam)", paddingTop: 16 }}>
          <label htmlFor="plan-note">Or reject it with a note for the planner</label>
          <textarea id="plan-note" className="textarea" style={{ minHeight: 80 }} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} aria-describedby="plan-note-hint" />
          <span id="plan-note-hint" className="hint">
            The planner writes a new plan from your note.
          </span>
        </div>
        <div className="actions">
          <button className="btn danger" type="button" disabled={busy} onClick={() => decide("rejected")}>
            Reject with note
          </button>
        </div>
      </form>
    </section>
  );
}

function AfterDecision({ row }: { row: PlanRow }) {
  const f = useFactory();
  const me = useMe();
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decider = canDecide(me.role);
  const builds = (f.jobs ?? []).filter((j) => (j.kind === "build_plan" || j.kind === "resume") && planIdOfJob(j, f.jobs ?? []) === row.id);
  const active = builds.find((j) => isActive(j));

  async function go(kind: "build_plan" | "replan") {
    setBusy(true);
    setError(null);
    const { jobId, error: e } = await requestJob(kind, { planId: row.id });
    setBusy(false);
    if (!jobId) return setError(`It didn't start: ${e}. Nothing changed; try again.`);
    if (e) toast(e);
    else toast(kind === "build_plan" ? "Build started. It runs on the factory worker; this page updates as it goes." : "Re-plan started. The new plan appears in Decisions.");
    await f.reload();
    nav(`/activity/${jobId}`);
  }

  return (
    <section className="plate sticky" aria-labelledby="after-h">
      <div className="plate-head">
        <h2 id="after-h">{row.status === "approved" ? "Approved" : row.status === "rejected" ? "Rejected" : "Waiting for an owner or admin"}</h2>
        <span className="quiet">{row.decided_at ? dateTime(row.decided_at) : null}</span>
      </div>
      <div className="plate-body stack-tight">
        {row.status === "approved" && row.build_track === "A" && (
          <>
            <Notice tone="clear">Approved as Track A{row.track_overridden ? ", against the recommendation" : ""}.</Notice>
            {active ? (
              <Link className="btn primary" to={`/activity/${active.id}`}>
                See the build that's running
              </Link>
            ) : (
              decider && (
                <div>
                  <button className="btn primary" type="button" disabled={busy} onClick={() => go("build_plan")}>
                    <ArrowRight aria-hidden="true" />
                    {busy ? "Starting…" : builds.length ? "Build it again" : "Start build"}
                  </button>
                </div>
              )
            )}
            <p className="quiet fine">Building and checking takes a few minutes. The result waits for your launch decision; nothing is published.</p>
          </>
        )}
        {row.status === "approved" && row.build_track === "B" && (
          <Notice tone="caution">Approved as Track B. The Track B builder arrives in Step 4B M4, so this plan can't be built yet.</Notice>
        )}
        {row.status === "approved" && !row.build_track && (
          <Notice tone="caution">This plan was approved before the track choice existed, so it can't be built. Start a new request for this client and approve the new plan with a track.</Notice>
        )}
        {row.status === "rejected" && (
          <>
            <p>
              Your note: <q>{row.decision_note}</q>
            </p>
            {row.revision < 2 ? (
              decider && (
                <div>
                  <button className="btn primary" type="button" disabled={busy} onClick={() => go("replan")}>
                    <ArrowClockwise aria-hidden="true" />
                    {busy ? "Starting…" : "Re-plan from my note"}
                  </button>
                </div>
              )
            ) : (
              <Notice tone="caution">This client has been re-planned twice already, the limit for automatic re-plans. Start a fresh request with a clearer brief.</Notice>
            )}
          </>
        )}
        {error && <Notice tone="stop">{error}</Notice>}
        {builds.length > 0 && (
          <div>
            <h3 style={{ fontSize: "var(--t-sm)", marginBottom: 8 }}>Builds of this plan</h3>
            <ul className="mini" style={{ padding: 0 }}>
              {builds.map((j) => {
                const s = jobState(j);
                return (
                  <li key={j.id} style={{ padding: "6px 0" }}>
                    <Aspect tone={s.tone}>{s.label}</Aspect>
                    <Link to={`/activity/${j.id}`}>{KIND_LABEL[j.kind]}</Link>
                    <span className="fig quiet">{shortDate(j.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function PlanPage() {
  const { id = "" } = useParams();
  const me = useMe();
  const plan = useLoad(() => fetchPlan(id), [id]);
  const row = plan.data;
  if (plan.error) return <LoadError what="this plan" error={plan.error} onRetry={plan.reload} />;
  if (plan.loading && !row) return <Loading rows={4} label="Loading the plan" />;
  if (!row) return <Empty title="This plan doesn't exist, or your role can't see it.">Plans are visible to owners and admins. <Link to="/decisions">Back to Decisions</Link></Empty>;
  const p = row.plan.plan;
  return (
    <>
      <PageHead
        kicker={row.status === "pending" ? "Plan decision" : `Plan, ${row.status}`}
        title={planName(row)}
        lead={`${LEAD_LABEL[p.intake?.leadType] ?? "Request"} for ${p.intake?.clientName ?? row.client_slug} (${row.entity_slug}). The planner wrote it from the client's request on ${dateTime(row.created_at)}${row.revision > 1 ? ", as a re-plan from your note" : ""}.`}
      />
      <div className="split">
        <PlanDetails row={row} />
        {row.status === "pending" && canDecide(me.role) ? <DecisionPanel row={row} onDone={plan.reload} /> : <AfterDecision row={row} />}
      </div>
    </>
  );
}

/* ---------------- accounts ---------------- */

export function AccountsTab() {
  const me = useMe();
  const f = useFactory();
  const toast = useToast();
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = f.accounts;
  const others = rows?.filter((r) => r.user_id !== me.userId) ?? [];
  const pending = others.filter((r) => r.status === "pending");
  const decided = others.filter((r) => r.status !== "pending").slice(0, 8);
  const grantable: Role[] = me.role === "owner" ? ["pm", "admin", "owner"] : ["pm"];

  async function decide(row: AccountRequestRow, decision: "approve" | "reject") {
    const role = roles[row.user_id] ?? "pm";
    const note = (notes[row.user_id] ?? "").trim();
    if (decision === "reject" && !note) return setError("Write a note before rejecting, so there's a record of why.");
    setBusyId(row.user_id);
    setError(null);
    const { error: e } = await supabase.rpc("decide_account_request", {
      p_user_id: row.user_id,
      p_decision: decision,
      p_role: decision === "approve" ? role : null,
      p_note: note || null,
    });
    setBusyId(null);
    if (e) return setError(`Your decision wasn't recorded: ${e.message}. Nothing changed.`);
    toast(decision === "approve" ? `${row.email} can now sign in as ${role}.` : `${row.email}'s request was rejected.`);
    await f.reload();
  }

  return (
    <>
      <Header />
      <Tabs />
      <div className="stack">
        <Plate title="Account requests" note={me.role === "admin" ? "As an admin you can approve PM accounts only." : "New accounts see nothing until you approve them."}>
          {!rows && !f.error && <Loading rows={2} label="Loading account requests" />}
          {f.error && <div className="plate-body"><LoadError what="account requests" error={f.error} onRetry={f.reload} /></div>}
          {rows && pending.length === 0 && <Empty title="No accounts are waiting for approval." />}
          {pending.length > 0 && (
            <ul className="rows">
              {pending.map((row) => (
                <li key={row.user_id} style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
                  <div>
                    <p className="what">{row.full_name ?? "No name given"}</p>
                    <p className="why">
                      {row.email}. Asked {dateTime(row.requested_at)}.
                    </p>
                  </div>
                  <div className="form-grid account-form">
                    <div className="field">
                      <label htmlFor={`role-${row.user_id}`}>Role</label>
                      <select id={`role-${row.user_id}`} className="select" value={roles[row.user_id] ?? "pm"} onChange={(e) => setRoles({ ...roles, [row.user_id]: e.target.value as Role })}>
                        {grantable.map((r) => (
                          <option key={r} value={r}>
                            {r === "pm" ? "PM" : r[0]!.toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`note-${row.user_id}`}>Note</label>
                      <input id={`note-${row.user_id}`} className="input" placeholder="Needed to reject" value={notes[row.user_id] ?? ""} onChange={(e) => setNotes({ ...notes, [row.user_id]: e.target.value })} />
                    </div>
                    <div className="actions">
                      <button className="btn go" type="button" disabled={busyId === row.user_id} onClick={() => decide(row, "approve")}>
                        Approve
                      </button>
                      <button className="btn danger" type="button" disabled={busyId === row.user_id} onClick={() => decide(row, "reject")}>
                        Reject
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Plate>
        {error && <Notice tone="stop">{error}</Notice>}
        {decided.length > 0 && (
          <Plate title="Recently decided">
            <ul className="rows">
              {decided.map((r) => (
                <li key={r.user_id}>
                  <Aspect tone={r.status === "approved" ? "clear" : "stop"}>{r.status === "approved" ? "Approved" : "Rejected"}</Aspect>
                  <div>
                    <p className="what">{r.full_name ?? r.email}</p>
                    <p className="why">
                      {r.email}
                      {r.decided_role ? `, as ${r.decided_role}` : ""}
                      {r.decision_note ? `. Note: “${r.decision_note}”` : ""}
                    </p>
                  </div>
                  <span className="when fig">{shortDate(r.requested_at)}</span>
                </li>
              ))}
            </ul>
          </Plate>
        )}
      </div>
    </>
  );
}

/* ---------------- stage moves ---------------- */

export function StageMove({ project, onMoved }: { project: ProjectRow; onMoved: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const next = nextStage(project.stage);
  const blocked = stageMoveBlock(project.stage);
  useEffect(() => setError(null), [open]);

  async function move() {
    if (!next || blocked) return;
    setBusy(true);
    const { data, error: e } = await supabase.from("projects").update({ stage: next }).eq("id", project.id).eq("stage", project.stage).select("id");
    setBusy(false);
    if (e) return setError(`The move wasn't recorded: ${e.message}. Nothing changed.`);
    if (!data || data.length === 0) return setError("The move wasn't recorded: the project already moved, or your role can't move stages.");
    setOpen(false);
    toast(`${project.name} moved to ${stageLabel(next)}.`);
    onMoved();
  }

  if (blocked) return <p className="quiet fine" style={{ maxWidth: "40ch" }}>{blocked}</p>;
  return (
    <>
      <button className="btn" type="button" onClick={() => setOpen(true)}>
        Move to {stageLabel(next!)}
      </button>
      <ConfirmDialog
        open={open}
        title={`Move ${project.name} to ${stageLabel(next!)}?`}
        body={`This records that ${stageLabel(project.stage)} is done. It doesn't build, publish or bill anything, and the Cockpit can't move it back.`}
        confirmLabel={`Move to ${stageLabel(next!)}`}
        busy={busy}
        error={error}
        onConfirm={move}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function StagesTab() {
  const projects = useLoad(fetchProjects, []);
  return (
    <>
      <Header />
      <Tabs />
      <Plate title="Move a project to its next stage" note="Launch is never moved from the Cockpit.">
        {projects.error && <div className="plate-body"><LoadError what="projects" error={projects.error} onRetry={projects.reload} /></div>}
        {!projects.data && !projects.error && <Loading rows={2} label="Loading projects" />}
        {projects.data && projects.data.length === 0 && <Empty title="No projects yet." />}
        {projects.data && projects.data.length > 0 && (
          <ul className="rows">
            {projects.data.map((p) => (
              <li key={p.id}>
                <Aspect tone="idle">{stageLabel(p.stage)}</Aspect>
                <div>
                  <Link className="what" to={`/projects/${p.id}`}>
                    {p.name}
                  </Link>
                  <p className="why">{p.clients?.name ?? "No client"}</p>
                </div>
                <StageMove project={p} onMoved={projects.reload} />
              </li>
            ))}
          </ul>
        )}
      </Plate>
    </>
  );
}
