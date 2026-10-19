/**
 * Decisions: plans (with the build-track choice), account requests and stage moves. Everything that
 * matters is enforced by the database, not here: plan_approvals' trigger (0007/0011) allows one decision,
 * requires a note to reject and a track to approve, and audits it; decide_account_request() (0010) checks
 * the caller's role; projects updates are owner/admin by RLS. This UI collects decisions and says plainly
 * what each one does and doesn't do. Launch is never moved from here (Step 4C decision D3).
 */
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { ArrowClockwise, Circle, Diamond, Play, RadioButton, SealCheck } from "@phosphor-icons/react";
import { Button, ButtonLink, StatusGlyph, TechDetails } from "../components/kit";
import { NeedRow } from "../components/flow";
import { buildsOf, KIND_OF_SITE } from "../lib/path";
import { currentInputs, savePlanInputs, SLOTS } from "../lib/inputs";
import { placeholdersOf } from "../components/Placeholders";
import { uploadImage, uploadLogo } from "../lib/brandUpload";
import { median } from "../lib/timeline";
import { buildStopLine, capped, costLine, fetchCostData, money, runSpend } from "../lib/costs";
import { supabase } from "../supabaseClient";
import { isActive, requestJob } from "../jobsClient";
import {
  LEAD_LABEL, dateTime, planName, shortDate,
  type PlanRow, type ProjectRow, type Track,
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
        Proposals {pendingPlans + launches > 0 && <span className="count">{pendingPlans + launches}</span>}
      </NavLink>
      <NavLink to="/team">Accounts {pendingAccounts > 0 && <span className="count">{pendingAccounts}</span>}</NavLink>
      <NavLink to="/decisions/stages">Stage moves</NavLink>
    </nav>
  );
}

function Header() {
  return (
    <PageHead
      title="Decisions"
      lead="Everything waiting for a person. Each decision is recorded with your name and the time."
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
        {f.error && <LoadError what="proposals" error={f.error} onRetry={f.reload} />}
        <Plate title="Proposals waiting for you">
          {!plans && !f.error && <Loading rows={2} label="Loading proposals" />}
          {plans && pending.length === 0 && (
            <Empty title="No proposals are waiting.">
              New proposals arrive here after you start a request. <Link to="/projects/new">Start one</Link>
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
                        {LEAD_LABEL[p.plan.plan.intake?.leadType] ?? "Request"}.{" "}
                        {rec?.track ? `${KIND_OF_SITE[rec.track] ?? "A kind of site"} recommended (${Math.round(rec.confidence * 100)}% sure).` : "No kind of site recommended."} Written {dateTime(p.created_at)}.
                        {p.revision > 1 ? " This is a revised proposal." : ""}
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
                          ? `${KIND_OF_SITE[p.build_track] ?? "A kind of site"}${p.track_overridden ? ", against the recommendation" : ""}.`
                          : "Approved before the kind of site was chosen: needs a new proposal."
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

/* ---------------- proposal ---------------- */

const KINDS: { t: Track; name: string; what: string }[] = [
  { t: "A", name: "Fast local site", what: "Quick to load, simple to use. Hours, directions and the call button come first." },
  { t: "B", name: "Showcase site with motion", what: "Large pictures and gentle motion between sections. Best when the work itself is the reason to visit." },
];

/** What every proposal page reads from the row: the client's name and words, the pages asked for, the open questions. */
function proposalFacts(row: PlanRow) {
  const p = row.plan.plan;
  const brief = p.brief as typeof p.brief & { requestText?: string; requested?: { pages?: string[] } };
  const words = brief.requestText?.trim();
  return {
    client: p.intake?.clientName ?? row.client_slug,
    goal: brief.goal,
    questions: [...p.openQuestions, ...(row.plan.direction?.openQuestions ?? [])],
    pages: brief.requested?.pages ?? [],
    quote: words ? (words.length > 600 ? `${words.slice(0, 597)}…` : words) : null,
  };
}

/** Proposal number, title, the goal, and the client's own words (design is.proposal). */
function ProposalHead({ row }: { row: PlanRow }) {
  const { client, goal, quote } = proposalFacts(row);
  return (
    <>
      <header className="proposal-head">
        <p className="t-eyebrow">
          Proposal {row.revision} · written {dateTime(row.created_at)}
        </p>
        <h1 className="t-title">A site for {client}</h1>
        <p className="t-lead muted">{goal}</p>
      </header>
      {quote && (
        <figure className="client-words">
          <figcaption className="t-small quiet">What the client wrote, in their own words</figcaption>
          <blockquote className="t-quote">“{quote}”</blockquote>
          <p className="t-small muted">{client}</p>
        </figure>
      )}
    </>
  );
}

/** The pages asked for and the questions still open. */
function ProposalColumns({ row, decided = false }: { row: PlanRow; decided?: boolean }) {
  const { pages, questions } = proposalFacts(row);
  return (
    <div className="proposal-cols">
      {pages.length > 0 && (
        <section aria-labelledby="pages-h" className="client-section">
          <h2 id="pages-h" className="t-section">
            Pages
          </h2>
          <ol className="proposal-pages">
            {pages.map((pg, i) => (
              <li key={pg}>
                <span className="fig quiet">{String(i + 1).padStart(2, "0")}</span>
                <b>{pg}</b>
              </li>
            ))}
          </ol>
        </section>
      )}
      {questions.length > 0 && (
        <section aria-labelledby="oq-h" className="client-section">
          <h2 id="oq-h" className="t-section">
            Questions still open
          </h2>
          <p className="muted">{decided ? "The factory could not answer these from the request." : "The factory could not answer these from the request. After you approve, they go on the details list, where you or the client can answer or skip them."}</p>
          <ul className="open-qs">
            {questions.map((q) => (
              <li key={q}>
                <Diamond weight="fill" aria-hidden="true" />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Build-quality Package 1: a plan whose direction step failed can have it run again on its own, before the owner decides,
 * instead of being built without a recommendation (Lanternworks plan 403305ec). The new plan row replaces this one.
 */
function RerunDirection({ row }: { row: PlanRow }) {
  const f = useFactory();
  const me = useMe();
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = (f.jobs ?? []).find((j) => j.kind === "direction" && j.params?.planId === row.id && isActive(j));
  if (row.status !== "pending" || !canDecide(me.role)) return null;
  if (running) return <Link className="btn" to={`/activity/${running.id}`}>The recommendation is being prepared again; see progress</Link>;
  async function go() {
    setConfirming(false);
    setBusy(true);
    setError(null);
    const { jobId, error: e } = await requestJob("direction", { planId: row.id });
    setBusy(false);
    if (!jobId) return setError(`It didn't start: ${e}. Nothing changed; try again.`);
    toast(e ?? "Preparing the recommendation again. The updated proposal appears in a minute or two.");
    await f.reload();
    nav(`/activity/${jobId}`);
  }
  return (
    <div className="stack-tight">
      <div>
        <button className="btn" type="button" disabled={busy} onClick={() => setConfirming(true)}>
          <ArrowClockwise aria-hidden="true" />
          {busy ? "Starting…" : "Prepare the direction again"}
        </button>
      </div>
      <p className="quiet fine">Reads the client's request again and suggests which kind of site to build. The proposal itself does not change.</p>
      {error && <Notice tone="stop">{error}</Notice>}
      <ConfirmDialog open={confirming} title="Prepare the direction again?" body="The factory reads the request again and recommends a kind of site." cost={`Costs a few cents. ${buildStopLine()}`} confirmLabel="Prepare it again" onConfirm={() => void go()} onCancel={() => setConfirming(false)} />
    </div>
  );
}

/**
 * Proposal review (Cockpit v2): what the factory proposes, in the client's own words; the kind of site as a radiogroup
 * with the recommendation and its real reasons; pages; open questions; and a sticky bar. Approving is the owner's
 * (locked rule; admins cannot approve proposals) and confirms first. "Ask for changes" records the note on this
 * proposal and requests a new one (the re-plan job, paid work, so it confirms the cost first).
 */
function ProposalReview({ row, onDone }: { row: PlanRow; onDone: () => void }) {
  const me = useMe();
  const f = useFactory();
  const toast = useToast();
  const nav = useNavigate();
  const owner = me.role === "owner";
  const decider = canDecide(me.role);
  const rec = row.plan.direction?.recommendation;
  const [kind, setKind] = useState<Track | undefined>(rec?.track ?? undefined);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<"approve" | "changes" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { client } = proposalFacts(row);
  const chosen = KINDS.find((k) => k.t === kind);
  const overriding = !!rec?.track && !!kind && kind !== rec.track;

  async function approve() {
    setConfirm(null);
    if (!kind) return setError("Choose the kind of site first.");
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.from("plan_approvals").update({ status: "approved", decision_note: null, build_track: kind }).eq("id", row.id).eq("status", "pending").select("id");
    setBusy(false);
    if (e) return setError(`It wasn't approved: ${e.message}. Nothing changed; try again.`);
    if (!data || data.length === 0) return setError("It wasn't approved: this proposal is no longer waiting, or your role can't approve it. Reload to see where it stands.");
    toast(`Approved as a ${chosen!.name}. Add anything missing, then start the build.`);
    await f.reload();
    onDone();
  }

  async function askForChanges() {
    setConfirm(null);
    const n = note.trim();
    if (!n) return setError("Write what should change first: the factory writes the new proposal from it.");
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.from("plan_approvals").update({ status: "rejected", decision_note: n }).eq("id", row.id).eq("status", "pending").select("id");
    if (e || !data || data.length === 0) {
      setBusy(false);
      return setError(e ? `Your note wasn't saved: ${e.message}. Nothing changed; try again.` : "Your note wasn't saved: this proposal is no longer waiting. Reload to see where it stands.");
    }
    if (row.revision >= 2) {
      setBusy(false);
      toast("Your note is saved. This client has had two new proposals already, the limit; start a fresh request with a clearer brief.");
      await f.reload();
      return onDone();
    }
    const { jobId, error: je } = await requestJob("replan", { planId: row.id });
    setBusy(false);
    await f.reload();
    if (!jobId) return setError(`Your note is saved, but the new proposal didn't start: ${je}. Start it again from this page.`);
    toast(je ?? `The factory is writing proposal ${row.revision + 1} from your note.`);
    nav(`/activity/${jobId}`);
  }

  const pick = (i: number) => {
    const n = (i + KINDS.length) % KINDS.length;
    setKind(KINDS[n]!.t);
    refs.current[n]?.focus();
  };

  return (
    <div className="proposal">
      <ProposalHead row={row} />
      <section aria-labelledby="kind-h" className="kind-section">
        <div>
          <h2 id="kind-h" className="t-section">
            Choose the kind of site
          </h2>
          <p className="muted">{rec?.track ? `The factory recommends a ${KINDS.find((k) => k.t === rec.track)!.name}. You can choose either.` : `The factory did not recommend one${rec?.withheldReason ? `: ${rec.withheldReason}` : ""}. You choose.`}</p>
        </div>
        <div role="radiogroup" aria-labelledby="kind-h" className="kind-cards">
          {KINDS.map((k, i) => {
            const on = kind === k.t;
            const recommended = rec?.track === k.t;
            return (
              <button
                key={k.t}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on || (!kind && i === 0) ? 0 : -1}
                className={on ? "kind-card on" : "kind-card"}
                disabled={!decider}
                onClick={() => setKind(k.t)}
                onKeyDown={(e) => {
                  if (["ArrowRight", "ArrowDown"].includes(e.key)) {
                    e.preventDefault();
                    pick(i + 1);
                  } else if (["ArrowLeft", "ArrowUp"].includes(e.key)) {
                    e.preventDefault();
                    pick(i - 1);
                  }
                }}
              >
                <span className="kind-top">
                  {on ? <RadioButton weight="fill" aria-hidden="true" /> : <Circle aria-hidden="true" />}
                  <span className="t-item">{k.name}</span>
                  {recommended && <span className="tag-recommended">Recommended</span>}
                </span>
                <span className="kind-what">{k.what}</span>
                {recommended && rec?.reasons?.length ? (
                  <ul className="kind-reasons">
                    {rec.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : null}
              </button>
            );
          })}
        </div>
        {overriding && <p className="t-small muted">You are choosing against the recommendation. That choice is recorded with the approval.</p>}
        {!row.plan.direction && (
          <div className="no-direction">
            <p className="muted">The factory could not prepare its recommendation for this proposal. You can still choose, or ask it to try again.</p>
            <RerunDirection row={row} />
            {row.plan.directionNote && (
              <TechDetails>
                <pre className="tech-log">{row.plan.directionNote}</pre>
              </TechDetails>
            )}
          </div>
        )}
      </section>
      <ProposalColumns row={row} />
      {error && <Notice tone="stop">{error}</Notice>}
      {decider && (
        <div className="sticky-bar">
          {asking && (
            <div className="changes">
              <label htmlFor="chg" className="t-label">
                What should change?
              </label>
              <textarea id="chg" className="textarea" rows={3} maxLength={2000} placeholder="For example: add a page for wholesale orders." value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="row-actions">
                <Button disabled={busy || !note.trim()} onClick={() => setConfirm("changes")}>
                  Send for a new proposal
                </Button>
                <span className="t-small muted">The factory writes proposal {row.revision + 1} from your note.</span>
              </div>
            </div>
          )}
          <div className="row-actions">
            {owner ? (
              <Button variant="primary" size="page" icon={SealCheck} disabled={busy || !kind} onClick={() => setConfirm("approve")}>
                {chosen ? `Approve as a ${chosen.name}` : "Choose the kind of site to approve"}
              </Button>
            ) : (
              <span className="t-small muted">{f.decider} approves proposals.</span>
            )}
            <Button size="page" aria-expanded={asking} onClick={() => setAsking(!asking)}>
              Ask for changes
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm === "approve"}
        title={`Approve as a ${chosen?.name ?? "kind of site"}?`}
        body={`The proposal for ${client} is approved${overriding ? ", against the recommendation" : ""}. Nothing is built or spent until you start a build.`}
        confirmLabel="Approve"
        onConfirm={() => void approve()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "changes"}
        title="Send for a new proposal?"
        body={`Your note is saved on proposal ${row.revision} and the factory writes proposal ${row.revision + 1} from it.`}
        cost={`Costs a few cents to read the note and write the proposal. ${buildStopLine()}`}
        confirmLabel="Send for a new proposal"
        onConfirm={() => void askForChanges()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

/**
 * What the site still needs (Cockpit v2): everything the client never gave us, grouped as Files, Details, Words and
 * Questions, each with why; Upload / Answer / "Build without it" (left out, never made up). A progress meter, the
 * placeholders still on the site (owner-only "launch with placeholders"), and a sticky "Start the build", disabled
 * until the logo is in (design rule), which confirms the cost first. Writes are the same plan_inputs rows as before.
 */
function NeedsScreen({ row }: { row: PlanRow }) {
  const me = useMe();
  const f = useFactory();
  const toast = useToast();
  const nav = useNavigate();
  const owner = me.role === "owner";
  const decider = canDecide(me.role);
  const costs = useLoad(async () => (owner ? fetchCostData() : null), [owner]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reopened, setReopened] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const p = row.plan.plan;
  const client = p.intake?.clientName ?? row.client_slug;
  const current = currentInputs((f.inputs ?? []).filter((i) => i.plan_id === row.id));
  const builds = buildsOf(row.id, f.jobs ?? []).sort((x, y) => y.created_at.localeCompare(x.created_at));
  const latest = builds[0] ?? null;
  const running = builds.find((j) => isActive(j));
  const briefLogo = !!(p.brief as { logo?: unknown }).logo;
  const slots = latest ? placeholdersOf(latest) : [];
  const questions = [...p.openQuestions, ...(row.plan.direction?.openQuestions ?? [])];

  type Item = { key: string; label: string; why: string; kind: "file" | "text"; group: "Files" | "Details" | "Words" | "Questions"; accept?: string; answer?: boolean };
  const items: Item[] = [
    { key: "asset.logo", label: "The logo", why: "It goes at the top of every page. The factory never draws one.", kind: "file", group: "Files", accept: ".svg,.png,.webp,image/svg+xml,image/png,image/webp" },
    ...slots.map((sl) => ({ key: `asset.image.${sl.slot}`, label: `Picture: ${sl.note}`, why: `For the ${sl.page === "index" ? "Home" : sl.page.replace(/-/g, " ")} page${sl.section ? `, ${sl.section}` : ""}. It should show ${sl.note.charAt(0).toLowerCase()}${sl.note.slice(1)}.`, kind: "file" as const, group: "Files" as const, accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" })),
    ...SLOTS.filter((sl) => sl.key !== "quotes").map((sl) => ({ key: sl.key, label: sl.label, why: sl.hint, kind: "text" as const, group: "Details" as const })),
    ...SLOTS.filter((sl) => sl.key === "quotes").map((sl) => ({ key: sl.key, label: sl.label, why: sl.hint, kind: "text" as const, group: "Words" as const })),
    ...questions.map((q, i) => ({ key: `q${i + 1}`, label: q, why: "An open question in the proposal. Your answer is given to the builder as a confirmed fact.", kind: "text" as const, group: "Questions" as const, answer: true })),
  ];
  const stateOf = (key: string): "open" | "done" | "skipped" => {
    if (reopened[key]) return "open";
    if (key === "asset.logo" && briefLogo) return "done";
    const r = current.find((c) => c.key === key);
    return !r ? "open" : r.waived ? "skipped" : (r.value ?? "").trim() ? "done" : "open";
  };
  const valueOf = (key: string) => {
    const r = current.find((c) => c.key === key);
    if (key === "asset.logo" && briefLogo && !r) return "Supplied with the request";
    if (!r?.value) return undefined;
    if (key.startsWith("asset.")) {
      try {
        const rec = JSON.parse(r.value) as { name?: string; path?: string; width?: number; height?: number };
        return rec.name ?? rec.path?.split("/").pop() ?? "File supplied";
      } catch {
        return "File supplied";
      }
    }
    return r.value;
  };
  const done = items.filter((i) => stateOf(i.key) === "done").length;
  const logoIn = stateOf("asset.logo") === "done";
  const leftOut = items.filter((i) => stateOf(i.key) !== "done").map((i) => i.label.replace(/^Picture: /, "").replace(/^The /, "the "));

  async function save(item: Item, value: string | null, waived: boolean) {
    setBusy(item.key);
    setError(null);
    const e = await savePlanInputs(row.id, [{ kind: item.answer ? "answer" : "fact", key: item.key, label: item.label.slice(0, 120), value, waived }]);
    setBusy(null);
    if (e) return setError(e);
    setReopened((r) => ({ ...r, [item.key]: false }));
    await f.reload();
    toast(waived ? `${item.label} will be left out, never made up.` : `${item.label} saved.`);
  }

  async function file(item: Item, fl: File) {
    setBusy(item.key);
    setError(null);
    const up = item.key === "asset.logo" ? await uploadLogo(fl) : await uploadImage(fl);
    if (!up.ok) {
      setBusy(null);
      return setError(up.reason);
    }
    await save(item, JSON.stringify({ ...up.record, name: fl.name }), false);
  }

  async function start() {
    setConfirm(false);
    setBusy("build");
    setError(null);
    const { jobId, error: e } = await requestJob("build_plan", { planId: row.id });
    setBusy(null);
    if (!jobId) return setError(/already in progress/i.test(e ?? "") ? "A build is already running for this client." : `The build didn't start: ${e}. Nothing changed; try again.`);
    toast(e ?? "The build has started. You can leave this page; it shows on Home when it finishes or needs you.");
    await f.reload();
    nav(`/activity/${jobId}`);
  }

  const runCosts = (costs.data?.runs ?? []).map((r) => capped(runSpend(r))).filter((x) => x > 0);
  const usual = runCosts.length >= 3 ? median(runCosts) : null;
  const groups = (["Files", "Details", "Words", "Questions"] as const).map((g) => [g, items.filter((i) => i.group === g)] as const).filter(([, l]) => l.length > 0);
  const remainingSlots = slots.filter((sl) => stateOf(`asset.image.${sl.slot}`) !== "done");
  const launchOk = current.find((c) => c.key === "launch.placeholders_ok")?.value === "yes";

  return (
    <div className="needs-page">
      <header className="needs-head">
        <h1 className="t-title">What the site still needs</h1>
        <p className="t-lead muted">Anything the client never gave us. Add it, answer it, or skip it. Anything skipped is left out of the site, never made up.</p>
        <div className="needs-meter">
          <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} aria-label={`${done} of ${items.length} supplied`}>
            <span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>
          <p aria-live="polite" className="t-label">
            {done} of {items.length} supplied
          </p>
        </div>
      </header>
      {groups.map(([g, list]) => (
        <section key={g} aria-labelledby={`g-${g}`} className="needs-group">
          <h2 id={`g-${g}`} className="t-item">
            {g}
          </h2>
          <ul className="needs-v2">
            {list.map((i) => (
              <NeedRow
                key={i.key}
                label={i.label}
                why={i.why}
                kind={i.kind}
                state={stateOf(i.key)}
                value={valueOf(i.key)}
                accept={i.accept}
                busy={!decider || busy !== null}
                onFile={(fl) => void file(i, fl)}
                onAnswer={(v) => void save(i, v, false)}
                onSkip={() => void save(i, null, true)}
                onChange={() => setReopened((r) => ({ ...r, [i.key]: true }))}
              />
            ))}
          </ul>
        </section>
      ))}
      <section aria-labelledby="ph-h" className="client-section">
        <h2 id="ph-h" className="t-item">
          Placeholders still on the site
        </h2>
        {!latest ? (
          <p className="muted">None yet: the site has not been built. After a build, any picture you skipped shows here as a labelled placeholder, and the site is not ready to launch until it is added or you knowingly accept it.</p>
        ) : remainingSlots.length === 0 ? (
          <p className="muted">None. Every picture on the site is one the client supplied.</p>
        ) : (
          <>
            <p className="muted">
              {remainingSlots.length} {remainingSlots.length === 1 ? "picture shows" : "pictures show"} “Image to come” on the last build. Add {remainingSlots.length === 1 ? "it" : "them"} above, or knowingly launch with {remainingSlots.length === 1 ? "it" : "them"}.
            </p>
            {owner ? (
              <label className="tick">
                <input type="checkbox" checked={launchOk} disabled={busy !== null} onChange={(e) => void save({ key: "launch.placeholders_ok", label: "Launch with placeholder pictures", why: "", kind: "text", group: "Details" }, e.target.checked ? "yes" : null, !e.target.checked)} />
                <span>Launch with placeholders: the client knows these pictures will show “Image to come” until they send them.</span>
              </label>
            ) : (
              <p className="t-small muted">Only an owner can choose to launch with placeholders.</p>
            )}
          </>
        )}
      </section>
      {error && <Notice tone="stop">{error}</Notice>}
      {decider && (
        <div className="sticky-bar">
          <div className="row-actions">
            {running ? (
              <ButtonLink to={`/activity/${running.id}`} variant="primary" size="page">
                Watch the build
              </ButtonLink>
            ) : (
              <Button variant="primary" size="page" icon={Play} disabled={!logoIn || busy !== null} onClick={() => setConfirm(true)}>
                {builds.length ? "Build it again" : "Start the build"}
              </Button>
            )}
            <p className="t-small muted start-line">
              {running
                ? "A build is running for this client."
                : !logoIn
                  ? "Add the logo to start the build. It goes at the top of every page."
                  : leftOut.length
                    ? `Ready to build. ${leftOut.length} ${leftOut.length === 1 ? "item" : "items"} will be left out, never made up: ${leftOut.join(", ")}.`
                    : "Ready to build. Everything is in."}
            </p>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title={builds.length ? "Build the site again?" : "Start the build?"}
        body={`${client}, ${row.build_track === "B" ? "Showcase site with motion" : "Fast local site"}. The factory builds it and runs every check. Nothing is published.`}
        cost={usual ? costLine(money(usual)) : `The cost depends on the site. ${buildStopLine()}`}
        confirmLabel={builds.length ? "Build it again" : "Start the build"}
        onConfirm={() => void start()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

/**
 * A proposal already decided without a build (Cockpit v2, Package 4 R2): the proposal review's own page, read-only, with the
 * design's decided line in place of the decision bar. Changes asked for: the note, then "Revise from my note" (owner or admin,
 * the same re-plan request, confirmed with its cost; refused after two revisions). Approved before the kind of site was
 * chosen: it cannot be built, and the one way forward is a new request.
 */
function DecidedProposal({ row }: { row: PlanRow }) {
  const me = useMe();
  const f = useFactory();
  const nav = useNavigate();
  const toast = useToast();
  const decider = canDecide(me.role);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rejected = row.status === "rejected";
  const rec = row.plan.direction?.recommendation;
  const recName = rec?.track ? KINDS.find((k) => k.t === rec.track)?.name : null;
  // A revision already asked for from this note (not failed or closed): open it instead of asking twice.
  const revision = (f.jobs ?? [])
    .filter((j) => j.kind === "replan" && j.params?.planId === row.id && j.status !== "failed" && j.status !== "cancelled")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const when = row.decided_at ? shortDate(row.decided_at) : null;

  async function revise() {
    setConfirm(false);
    setBusy(true);
    setError(null);
    const { jobId, error: e } = await requestJob("replan", { planId: row.id });
    setBusy(false);
    if (!jobId) return setError(`It didn't start: ${e}. Nothing changed; try again.`);
    toast(e ?? `The factory is writing proposal ${row.revision + 1} from your note.`);
    await f.reload();
    nav(`/activity/${jobId}`);
  }

  return (
    <div className="proposal">
      <ProposalHead row={row} />
      <section aria-labelledby="kind-h" className="kind-section">
        <h2 id="kind-h" className="t-section">
          The kind of site
        </h2>
        <p className="muted">
          {rejected
            ? `None was chosen, because changes were asked for${recName ? `. The factory had recommended a ${recName}` : ""}.`
            : "None was chosen: this proposal was approved before the Cockpit asked for the kind of site."}
        </p>
      </section>
      <ProposalColumns row={row} decided />
      <section aria-labelledby="decision-h" className="proposal-decision">
        <h2 id="decision-h" className="sr-only">
          The decision
        </h2>
        {rejected ? (
          <>
            <p role="status" className="proposal-done proposal-done-need">
              <StatusGlyph tone="need" />
              Changes asked for{when ? ` on ${when}` : ""}.
            </p>
            {row.decision_note && (
              <figure className="client-words">
                <figcaption className="t-small quiet">The note</figcaption>
                <blockquote className="t-quote">“{row.decision_note}”</blockquote>
              </figure>
            )}
            {revision ? (
              <div className="row-actions">
                <ButtonLink to={`/activity/${revision.id}`} variant="primary" size="page">
                  See proposal {row.revision + 1} being written
                </ButtonLink>
              </div>
            ) : row.revision >= 2 ? (
              <>
                <p className="muted">This client has had two new proposals already, the limit for automatic revisions. Start a fresh request with a clearer brief.</p>
                <div className="row-actions">
                  <ButtonLink to="/projects/new" variant="primary" size="page">
                    Start a new request
                  </ButtonLink>
                </div>
              </>
            ) : decider ? (
              <div className="row-actions">
                <Button variant="primary" size="page" icon={ArrowClockwise} disabled={busy} onClick={() => setConfirm(true)}>
                  {busy ? "Starting…" : "Revise from my note"}
                </Button>
                <span className="t-small muted">The factory writes proposal {row.revision + 1} from the note.</span>
              </div>
            ) : (
              <p className="t-small muted">{f.decider} can ask the factory for a new proposal from this note.</p>
            )}
          </>
        ) : (
          <>
            <p role="status" className="proposal-done">
              <StatusGlyph tone="done" />
              Approved{when ? ` on ${when}` : ""}, without a kind of site.
            </p>
            <p className="muted">It can't be built: a build needs the kind of site. Start a new request for {proposalFacts(row).client} and approve its proposal with a kind of site.</p>
            <div className="row-actions">
              <ButtonLink to="/projects/new" variant="primary" size="page">
                Start a new request
              </ButtonLink>
            </div>
          </>
        )}
        {error && <Notice tone="stop">{error}</Notice>}
      </section>
      <ConfirmDialog
        open={confirm}
        title="Revise from your note?"
        body={`The factory reads your note and writes proposal ${row.revision + 1}. This proposal stays as it is.`}
        cost={`Costs a few cents to read the note and write the proposal. ${buildStopLine()}`}
        confirmLabel="Revise from my note"
        busy={busy}
        onConfirm={() => void revise()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

export function PlanPage() {
  const { id = "" } = useParams();
  const plan = useLoad(() => fetchPlan(id), [id]);
  const row = plan.data;
  if (plan.error) return <LoadError what="this proposal" error={plan.error} onRetry={plan.reload} />;
  if (plan.loading && !row) return <Loading rows={4} label="Loading the proposal" />;
  if (!row) return <Empty title="This proposal doesn't exist, or your role can't see it.">Proposals are visible to owners and admins. <Link to="/decisions">Back to Decisions</Link></Empty>;
  // Cockpit v2: waiting → the proposal review; approved with a kind of site → what the site still needs; anything else
  // (changes asked for, or approved before the kind of site existed) → the same page, read-only, with the decision.
  if (row.status === "pending") return <ProposalReview row={row} onDone={plan.reload} />;
  if (row.status === "approved" && row.build_track) return <NeedsScreen row={row} />;
  return <DecidedProposal row={row} />;
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
