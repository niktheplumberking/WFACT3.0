/**
 * Step 4D, the owner's side of a stopped build. Two pieces:
 *
 *   <DetailsForm>   "We need these from the client": the missing details as plain fields (or "skip it"), saved to the plan.
 *   <RecoveryPanel> "What happened, what is saved, and the one button": reads the diagnosis, asks for any missing details first,
 *                   then carries the build on from where it stopped.
 *
 * No technical words on the surface; the raw error and run ids stay in Technical details on the run page.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { ArrowClockwise, Check, ClipboardText, Warning } from "@phosphor-icons/react";
import { requestJob, type JobRow } from "../jobsClient";
import { SLOTS, fetchPlanInputs, savePlanInputs, type NewInput, type PlanInputRow } from "../lib/inputs";
import { carryOnRequest, diagnoseJob, reportText, unansweredNeeds, type Diagnosis, type Need } from "../lib/recovery";
import { useLoad, useToast } from "../lib/state";
import { Notice, Plate } from "./ui";

/* ---------------- the form ---------------- */

interface FieldState {
  value: string;
  skip: boolean;
}

export function slotAsNeed(key: string): Need | null {
  const s = SLOTS.find((x) => x.key === key);
  return s ? { key: s.key, label: s.label, hint: s.hint, multiline: s.multiline, why: "", kind: "fact" } : null;
}

/**
 * Fields for `needs`, pre-filled with what is already saved. Saving is all-or-nothing (one insert). `onSaved` runs after it.
 */
export function DetailsForm({
  planId,
  needs,
  current,
  unavailable,
  saveLabel,
  busy,
  onSaved,
  requireSomething,
}: {
  planId: string;
  needs: Need[];
  current: PlanInputRow[];
  unavailable: boolean;
  saveLabel: string;
  busy?: boolean;
  onSaved: (savedCount: number) => void | Promise<void>;
  /** In recovery, saving nothing is not a way to continue: at least one answer or one skip is required. */
  requireSomething?: boolean;
}) {
  const uid = useId();
  const byKey = useMemo(() => new Map(current.map((c) => [c.key, c])), [current]);
  const [fields, setFields] = useState<Record<string, FieldState>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFields((prev) => {
      const next: Record<string, FieldState> = {};
      for (const n of needs) {
        const c = byKey.get(n.key);
        next[n.key] = prev[n.key] ?? { value: c && !c.waived ? (c.value ?? "") : "", skip: !!c?.waived };
      }
      return next;
    });
  }, [needs, byKey]);

  if (unavailable) {
    return <Notice tone="caution">Adding details isn't switched on yet: a database update is still waiting to be applied. Ask Huraira to apply it, then come back.</Notice>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const rows: NewInput[] = [];
    for (const n of needs) {
      const f = fields[n.key] ?? { value: "", skip: false };
      const value = f.value.trim();
      const was = byKey.get(n.key);
      if (f.skip) {
        if (!was?.waived) rows.push({ kind: n.kind, key: n.key, label: n.label, value: null, waived: true });
      } else if (value) {
        if (was?.waived || (was?.value ?? "") !== value) rows.push({ kind: n.kind, key: n.key, label: n.label, value, waived: false });
      }
    }
    const alreadyAnswered = needs.filter((n) => {
      const c = byKey.get(n.key);
      return !!c && (c.waived || (c.value ?? "").trim() !== "");
    }).length;
    if (rows.length === 0 && requireSomething && alreadyAnswered === 0) {
      return setError("Fill in at least one detail, or tick “Skip” for the ones you don't have. Skipping is fine: the site then labels those parts as sample text.");
    }
    setSaving(true);
    const err = await savePlanInputs(planId, rows);
    setSaving(false);
    if (err) return setError(err);
    await onSaved(rows.length);
  }

  return (
    <form className="stack-tight" onSubmit={submit} aria-label="Details for the build">
      {needs.map((n) => {
        const f = fields[n.key] ?? { value: "", skip: false };
        const id = `${uid}-${n.key}`;
        const set = (patch: Partial<FieldState>) => setFields((p) => ({ ...p, [n.key]: { ...(p[n.key] ?? { value: "", skip: false }), ...patch } }));
        return (
          <div className="field" key={n.key}>
            <label htmlFor={id}>{n.label}</label>
            {n.multiline ? (
              <textarea id={id} className="textarea" style={{ minHeight: 84 }} value={f.value} maxLength={2000} disabled={f.skip} onChange={(e) => set({ value: e.target.value })} aria-describedby={`${id}-h`} />
            ) : (
              <input id={id} className="input" value={f.value} maxLength={2000} disabled={f.skip} onChange={(e) => set({ value: e.target.value })} aria-describedby={`${id}-h`} />
            )}
            <span id={`${id}-h`} className="hint">
              {n.why ? `${n.why} ` : ""}
              {n.hint}
            </span>
            <label className="row-wrap" style={{ fontWeight: 400, gap: 8 }}>
              <input type="checkbox" checked={f.skip} onChange={(e) => set({ skip: e.target.checked, ...(e.target.checked ? { value: "" } : {}) })} />
              Skip this: build without it (the site labels it as sample text, or leaves the part out)
            </label>
          </div>
        );
      })}
      {error && <Notice tone="stop">{error}</Notice>}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={saving || busy}>
          <Check aria-hidden="true" />
          {saving ? "Saving…" : saveLabel}
        </button>
      </div>
    </form>
  );
}

/* ---------------- the panel ---------------- */

/** The plain steps of a build and where this one stopped. */
function Progress({ d }: { d: Diagnosis }) {
  const wrote = d.saved === "built" || d.saved === "verified";
  const passed = d.saved === "verified";
  const checksFailed = wrote && !passed;
  return (
    <ol className="steps" aria-label="Where the build stopped">
      <li className="ok">
        <b>Plan approved</b>
        <span className="muted">The plan and the track were your decision.</span>
      </li>
      <li className={wrote ? "ok" : "bad"}>
        <b>{wrote ? "Site written and saved" : "Site not written yet"}</b>
        <span className="muted">{wrote ? "Kept safely. Carrying on does not pay for it again." : "It stopped before it could save anything."}</span>
      </li>
      <li className={passed ? "ok" : checksFailed ? "bad" : "notrun"}>
        <b>{passed ? "Every check passed" : checksFailed ? "Quality checks stopped it" : "Quality checks not reached"}</b>
        <span className="muted">{passed ? "Ready for your launch decision." : checksFailed ? "The site is saved; it did not pass its checks (see below)." : "They run once the site is written."}</span>
      </li>
      <li className="notrun">
        <b>Launch</b>
        <span className="muted">Always your decision, outside the Cockpit.</span>
      </li>
    </ol>
  );
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function RecoveryPanel({
  job,
  siblings,
  planId,
  planName,
  onChanged,
  onStarted,
}: {
  job: JobRow;
  siblings: JobRow[];
  planId: string | null;
  planName: string | null;
  onChanged: () => Promise<void> | void;
  onStarted: (jobId: string) => void;
}) {
  const toast = useToast();
  const d = useMemo(() => diagnoseJob(job, siblings, { planId }), [job, siblings, planId]);
  const inputs = useLoad(() => (planId ? fetchPlanInputs(planId) : Promise.resolve({ rows: [] as PlanInputRow[], unavailable: false })), [planId]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const current = inputs.data?.rows ?? [];
  const open = d.cause === "info" && planId ? unansweredNeeds(d.needs, current) : [];
  const req = carryOnRequest(job, d, planId);
  const report = reportText(job, d, planName);

  async function carryOn() {
    if (!req) return;
    setBusy(true);
    setErr(null);
    const { jobId, error } = await requestJob(req.kind, req.params);
    setBusy(false);
    if (!jobId) {
      if (/already in progress/i.test(error ?? "")) return setErr("This build is already running (someone else may have started it). Open it from Activity instead of starting another.");
      return setErr(`It didn't start: ${error}. Nothing changed${d.needs.length > 0 ? "; any details you entered are saved" : ""}.`);
    }
    if (error) toast(error);
    else toast(d.carryOn === "continue" ? "Continuing from the saved step." : "Started again.");
    await onChanged();
    onStarted(jobId);
  }

  async function copyReport() {
    const ok = await copy(report);
    if (ok) toast("Report copied. Paste it to Huraira.");
    else setShowReport(true);
  }

  const askFirst = d.cause === "info" && !!planId && open.length > 0;

  return (
    <Plate title="What happened and what to do">
      <div className="plate-body stack-tight">
        <Notice tone="stop" title="What happened.">
          {d.happened}
        </Notice>
        <Progress d={d} />
        <p className="muted" style={{ margin: 0 }}>
          <b>What's kept.</b> {d.savedText}
        </p>

        {d.repeating && (
          <Notice tone="caution" title="This keeps happening.">
            The build has now stopped for the same reason three times. Trying again is unlikely to change that. Send Huraira the report instead.
          </Notice>
        )}

        {d.actor === "huraira" && !d.repeating && (
          <Notice tone="info" title="Who fixes this.">
            {d.cause === "factory" ? "Huraira does: it is a problem inside the factory, not something you or the client did." : "Huraira does: it is a setting or limit on the factory worker."} You can copy a report for them below.
          </Notice>
        )}

        {d.cause === "money" && (
          <Notice tone="info" title="Money decision.">
            Adding credits to Agent 37 is a spending decision, so it is yours or Nick's. Once credits are added, press the button: it carries on from the saved step.
          </Notice>
        )}

        {d.cause === "fixable" && (
          <Notice tone="info" title="What the builder will do.">
            It reads each failed check, fixes the site it already saved, and the checks run again. You get a fresh set of attempts this time.
          </Notice>
        )}

        {askFirst && (
          <div className="stack-tight">
            <h3 style={{ fontSize: "var(--t-md)", margin: 0 }}>We need {open.length === 1 ? "this from the client" : "these from the client"}</h3>
            {inputs.loading && !inputs.data ? (
              <p className="muted">Checking what you've already given…</p>
            ) : (
              <DetailsForm
                planId={planId!}
                needs={open}
                current={current}
                unavailable={inputs.data?.unavailable ?? false}
                busy={busy}
                requireSomething
                saveLabel={d.carryOnLabel}
                onSaved={async () => {
                  await inputs.reload();
                  await carryOn();
                }}
              />
            )}
          </div>
        )}

        {d.cause === "info" && !planId && (
          <Notice tone="caution">The factory needs details, but this run isn't linked to a plan, so they can't be saved here. Open the plan and add them there.</Notice>
        )}

        {err && (
          <Notice tone="stop" title="That didn't work.">
            {err}
          </Notice>
        )}

        <div className="actions">
          {!askFirst && req && (
            <button className={`btn ${d.reportFirst ? "ghost" : "primary"}`} type="button" disabled={busy} onClick={carryOn}>
              <ArrowClockwise aria-hidden="true" />
              {busy ? "Starting…" : d.carryOnLabel}
            </button>
          )}
          {(askFirst || d.actor === "huraira" || d.cause === "unknown" || d.repeating) && (
            <button className={`btn ${d.reportFirst ? "primary" : "ghost"}`} type="button" onClick={copyReport}>
              <ClipboardText aria-hidden="true" />
              Copy a report for Huraira
            </button>
          )}
          {!askFirst && !req && d.cause !== "info" && <span className="quiet fine">There's nothing to press here: start a new request from the plan.</span>}
        </div>
        {showReport && (
          <div className="field">
            <label htmlFor="report-text">Copy this by hand (your browser blocked copying)</label>
            <textarea id="report-text" className="textarea" readOnly value={report} style={{ minHeight: 160 }} onFocus={(e) => e.currentTarget.select()} />
          </div>
        )}
        <p className="quiet fine" style={{ margin: 0 }}>
          <Warning aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Nothing here publishes a site. Launch stays a human decision.
        </p>
      </div>
    </Plate>
  );
}

/* ---------------- details wanted before launch (a build that passed) ---------------- */

/**
 * A build can pass every check and still say "the client has to supply X before this can go live". List those, take the answers,
 * and offer a new build that uses them. The passing build stays as it is.
 */
export function ClientNeedsPanel({ job, planId, onStarted }: { job: JobRow; planId: string | null; onStarted: (jobId: string) => void }) {
  const toast = useToast();
  const lines = (Array.isArray(job.result?.needsFromClient) ? (job.result!.needsFromClient as unknown[]) : []).filter((x): x is string => typeof x === "string");
  const needs = useMemo(() => diagnoseJob({ ...job, status: "failed" }, [], { planId }).needs, [job, planId]);
  const inputs = useLoad(() => (planId && needs.length ? fetchPlanInputs(planId) : Promise.resolve({ rows: [] as PlanInputRow[], unavailable: false })), [planId, needs.length]);
  const [err, setErr] = useState<string | null>(null);
  if (lines.length === 0 || !planId) return null;
  const open = unansweredNeeds(needs, inputs.data?.rows ?? []);
  return (
    <Plate title="Still needed from the client" note="The build passed; these must be settled before it can go live.">
      <div className="plate-body stack-tight">
        <ul className="plain">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        {open.length > 0 && (
          <>
            <p className="muted" style={{ margin: 0 }}>Fill in what you have; the build is run again with it. This build stays as it is.</p>
            <DetailsForm
              planId={planId}
              needs={open}
              current={inputs.data?.rows ?? []}
              unavailable={inputs.data?.unavailable ?? false}
              saveLabel="Save and build again with these"
              requireSomething
              onSaved={async () => {
                setErr(null);
                const { jobId, error } = await requestJob("build_plan", { planId });
                if (!jobId) return setErr(/already in progress/i.test(error ?? "") ? "A build of this plan is already running. Your details are saved." : `Your details are saved, but the build didn't start: ${error}.`);
                toast("Building again with your details.");
                onStarted(jobId);
              }}
            />
            {err && <Notice tone="stop">{err}</Notice>}
          </>
        )}
      </div>
    </Plate>
  );
}

/* ---------------- details to add before building (plan page) ---------------- */

const questionKey = (i: number) => `q${i + 1}`;

/** The plan page's "add what you know now": the usual missing facts, and an answer box per open question. */
export function BeforeBuild({ planId, questions, onChanged }: { planId: string; questions: string[]; onChanged?: () => void }) {
  const toast = useToast();
  const inputs = useLoad(() => fetchPlanInputs(planId), [planId]);
  const needs: Need[] = useMemo(
    () => [
      ...SLOTS.map((s) => ({ key: s.key, label: s.label, hint: s.hint, multiline: s.multiline, why: "", kind: "fact" as const })),
      ...questions.map((q, i) => ({
        key: questionKey(i),
        label: q.length > 120 ? `${q.slice(0, 117)}...` : q,
        hint: "Your answer is given to the builder as a confirmed fact.",
        multiline: true,
        why: "",
        kind: "answer" as const,
      })),
    ],
    [questions],
  );
  const given = (inputs.data?.rows ?? []).filter((r) => !r.waived && (r.value ?? "").trim() !== "").length;
  const skipped = (inputs.data?.rows ?? []).filter((r) => r.waived).length;
  if (inputs.error) return null;
  return (
    <details className="raw">
      <summary>
        Details you can add before building
        {inputs.data ? ` (${given} added${skipped ? `, ${skipped} skipped` : ""})` : ""}
      </summary>
      <div className="stack-tight" style={{ marginTop: 12 }}>
        <p className="muted" style={{ margin: 0 }}>
          Optional. Anything you leave out is labelled as sample text on the site, and the checks will say so. Adding it now saves a round later.
        </p>
        {inputs.loading && !inputs.data ? (
          <p className="muted">Loading…</p>
        ) : (
          <DetailsForm
            planId={planId}
            needs={needs}
            current={inputs.data?.rows ?? []}
            unavailable={inputs.data?.unavailable ?? false}
            saveLabel="Save these details"
            onSaved={async (n) => {
              toast(n === 0 ? "Nothing new to save." : `Saved ${n} detail${n === 1 ? "" : "s"}. The next build uses them.`);
              await inputs.reload();
              onChanged?.();
            }}
          />
        )}
      </div>
    </details>
  );
}
