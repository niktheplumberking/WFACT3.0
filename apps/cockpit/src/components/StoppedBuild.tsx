/**
 * The stopped build (Cockpit v2, brief §7.8): chip, headline, the facts (money, what it tried), the checks that still fail,
 * who acts, the fix, then Why?. The case (lib/stopCases.ts) picks the words; what is sent is still continueOptions() and
 * carryOnRequest() (lib/recovery.ts) through requestJob, and details still go through savePlanInputs. Every paid move is
 * confirmed with its rough cost and the per-build stop. Nothing here publishes a site.
 */
import { useMemo, useState } from "react";
import { requestJob, type JobRow } from "../jobsClient";
import { fetchPlanInputs, savePlanInputs, type PlanInputRow } from "../lib/inputs";
import { carryOnRequest, continueOptions, diagnoseJob, jobFromStep, reportText, unansweredNeeds, type ContinueOption } from "../lib/recovery";
import { evidenceOf, failedChecks, stopCaseOf } from "../lib/stopCases";
import type { Timeline } from "../lib/timeline";
import { CAPS, buildStopLine, fetchRunSpend, money, total } from "../lib/costs";
import { useLoad, useMe, useToast } from "../lib/state";
import { StatusChip, TechDetails } from "./kit";
import { FixCard, StopFacts, WhyDisclosure, type FixChoice, type FixInput } from "./flow";
import { DetailsForm } from "./Recovery";
import { ConfirmDialog, Notice } from "./ui";

const NOTHING_SPENT = new Set(["needs_input", "provider_unavailable"]);

/** What each way of carrying on costs, said before anything starts. */
function confirmOf(o: ContinueOption): { title: string; body: string; cost: string } {
  const stop = buildStopLine();
  if (o.id === "rebuild" || o.id === "rerun")
    return { title: "Write the site again from the proposal?", body: "This starts a new build from the approved proposal. Nothing is published, and this build's history is kept.", cost: `Costs about one build. ${stop}` };
  if (o.id === "qa") return { title: "Check again without changes?", body: "The checks run again on the saved site. The builder is not used. Nothing is published.", cost: `Costs much less than a new build: only the checks run. ${stop}` };
  if (o.id === "revise") return { title: "Fix it and continue?", body: "The builder fixes the saved site using what the checks found, then the checks run again. Nothing is published.", cost: `Costs less than a new build. ${stop}` };
  return { title: "Continue the build?", body: `${o.hint} Nothing is published.`, cost: `Costs at most one build. ${stop}` };
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export interface StoppedBuildProps {
  job: JobRow;
  siblings: JobRow[];
  planId: string | null;
  planName: string | null;
  /** "Northlight Signs · Build 2" */
  context: string;
  timeline: Timeline;
  onChanged: () => Promise<void> | void;
  onStarted: (jobId: string) => void;
  onArchive?: () => void;
}

export function StoppedBuild({ job, siblings, planId, planName, context, timeline, onChanged, onStarted, onArchive }: StoppedBuildProps) {
  const toast = useToast();
  const me = useMe();
  const owner = me.role === "owner";
  const d = useMemo(() => diagnoseJob(job, siblings, { planId }), [job, siblings, planId]);
  const sc = stopCaseOf(job, d, timeline.haltStatus);
  const r = (job.result ?? {}) as Record<string, unknown>;
  const runId = typeof r.workflowRunId === "string" ? r.workflowRunId : null;
  const resultStatus = typeof r.status === "string" ? r.status : null;
  const status = timeline.haltStatus ?? resultStatus;
  const inputs = useLoad(() => (planId ? fetchPlanInputs(planId) : Promise.resolve({ rows: [] as PlanInputRow[], unavailable: false })), [planId]);
  const spend = useLoad(() => (owner && runId ? fetchRunSpend(runId) : Promise.resolve(null)), [owner, runId]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ o: ContinueOption; label: string; save?: () => Promise<string | null> } | null>(null);
  const [showNote, setShowNote] = useState<string | null>(null);
  const [mode, setMode] = useState<"add" | "without">("add");
  const [value, setValue] = useState("");

  const current = inputs.data?.rows ?? [];
  const open = d.cause === "info" && planId ? unansweredNeeds(d.needs, current) : [];
  const options = continueOptions({
    haltStatus: status,
    stoppedIn: timeline.stoppedIn,
    saved: d.saved,
    canReopen: d.carryOn === "continue",
    canRerun: d.carryOn === "rerun",
    hasNeeds: open.length > 0,
    cause: d.cause,
    causeLabel: d.carryOnLabel,
    jobFromStep: jobFromStep(job),
  });
  const find = (...ids: ContinueOption["id"][]) => options.find((o) => ids.includes(o.id));
  // "Write the site again" from a run that can be reopened: the engine's rebuild step, a full build.
  const writeAgain: ContinueOption | undefined =
    find("rebuild", "rerun") ??
    (d.carryOn === "continue" ? { id: "rebuild", fromStep: "rebuild", label: "Write the site again from the proposal", hint: "", primary: false, toast: "Building again from the proposal." } : undefined);

  let primaryOpt: ContinueOption | undefined;
  const otherOpts: ContinueOption[] = [];
  switch (sc.id) {
    case 1:
    case 2:
      primaryOpt = options.find((o) => o.needsDetails) ?? options[0];
      if (sc.id === 2 && writeAgain && writeAgain !== primaryOpt) otherOpts.push(writeAgain);
      break;
    case 3:
      primaryOpt = find("qa") ?? options[0];
      break;
    case 5:
      primaryOpt = find("revise") ?? options[0];
      if (find("qa") && primaryOpt?.id !== "qa") otherOpts.push(find("qa")!);
      break;
    case 7:
      primaryOpt = writeAgain ?? options[0];
      break;
    case 8:
      primaryOpt = find("auto", "revise", "qa") ?? options[0];
      if (writeAgain && writeAgain !== primaryOpt) otherOpts.push(writeAgain);
      break;
    case 4:
      primaryOpt = options[0];
      break;
    case "factory":
      if (options[0]) otherOpts.push(options[0]);
      break;
    case 6:
      break;
  }

  const report = reportText(job, d, planName);
  const note = sc.id === 6 ? `Please raise the spending limit for this build${CAPS.perBuildUsd != null ? ` (it stopped at $${CAPS.perBuildUsd.toFixed(2)})` : ""}.\n\n${report}` : report;

  async function carryOn(o: ContinueOption, save?: () => Promise<string | null>) {
    setBusy(true);
    setErr(null);
    if (save) {
      const e = await save();
      if (e) {
        setBusy(false);
        return setErr(e);
      }
      await inputs.reload();
    }
    const req = o.id === "rerun" ? carryOnRequest(job, { carryOn: "rerun", headline: d.headline }, planId) : carryOnRequest(job, { carryOn: "continue", headline: d.headline }, planId, o.fromStep);
    if (!req) {
      setBusy(false);
      setConfirming(null);
      return setErr("There's nothing this button can start for this build. Start a new build from the proposal instead. Nothing changed.");
    }
    const { jobId, error } = await requestJob(req.kind, req.params);
    setBusy(false);
    if (!jobId) {
      if (/already in progress/i.test(error ?? "")) return setErr("This build is already running (someone else may have started it). Open it from Activity instead of starting another.");
      return setErr(`It didn't start: ${error}. Nothing changed${save ? "; the details you entered are saved" : ""}.`);
    }
    setConfirming(null);
    toast(error ?? o.toast);
    await onChanged();
    onStarted(jobId);
  }

  async function copyNote(who: string) {
    if (await copy(note)) toast(`Note copied. Send it to ${who}.`);
    else setShowNote(who);
  }

  /** Opens the money confirm; `label` is the button's own words, repeated on the confirm. */
  const ask = (o: ContinueOption, label: string, save?: () => Promise<string | null>) => {
    setErr(null);
    setConfirming({ o, label, save });
  };

  // Case 2 with one fact: "Add the real X" or "Build without it", inline.
  const single = sc.id === 2 && open.length === 1 && open[0]!.kind === "fact" ? open[0]! : null;
  const fixInput: FixInput | undefined = single
    ? {
        addLabel: `Add the real ${single.label.toLowerCase()}`,
        fieldLabel: `The real ${single.label.toLowerCase()}`,
        withoutLabel: `Build without ${/s$/i.test(single.label) ? "them" : "it"}`,
        withoutNote: "The site leaves it out, or labels that part as sample text.",
        mode,
        value,
        inputMode: /phone/i.test(single.key) ? "tel" : /email/i.test(single.key) ? "email" : "text",
        onMode: setMode,
        onValue: setValue,
      }
    : undefined;
  const viaForm = (sc.id === 1 || sc.id === 2) && !single && open.length > 0 && !!planId && !!primaryOpt;

  let primary: FixChoice | undefined;
  if (sc.id === 6) primary = { label: sc.fix, onClick: () => void copyNote("Nick") };
  else if (sc.id === "factory") primary = { label: sc.fix, onClick: () => void copyNote("Huraira") };
  else if (single && primaryOpt && planId) {
    primary = {
      label: sc.fix,
      disabled: busy,
      onClick: () => {
        if (mode === "add" && !value.trim()) return setErr(`Type the real ${single.label.toLowerCase()} first, or choose “Build without”.`);
        const row = mode === "add" ? { kind: "fact" as const, key: single.key, label: single.label, value: value.trim(), waived: false } : { kind: "fact" as const, key: single.key, label: single.label, value: null, waived: true };
        ask(primaryOpt!, sc.fix, () => savePlanInputs(planId, [row]));
      },
    };
  } else if (primaryOpt && !viaForm) primary = { label: sc.fix, disabled: busy, onClick: () => ask(primaryOpt!, sc.fix) };

  const others: FixChoice[] = [
    ...otherOpts.map((o) => {
      const label = sc.id === "factory" ? "Try again anyway" : o === writeAgain ? "Write the site again from the proposal" : o.id === "qa" ? "Check again without changes" : o.label;
      return { label, disabled: busy, onClick: () => ask(o, label) };
    }),
    ...(sc.id === 4 ? [{ label: "Copy a note for Huraira", onClick: () => void copyNote("Huraira") }] : []),
    ...(onArchive ? [{ label: "Put this build away", onClick: onArchive }] : []),
  ];

  // The money fact: only what the records say, and only owners read cost.
  const nothing = !!status && NOTHING_SPENT.has(status);
  const s = spend.data;
  const spentAmt = s ? total(s) : 0;
  const moneyFact: { spent: boolean | null; text: string } = nothing
    ? { spent: false, text: "No money was spent" }
    : !owner
      ? { spent: null, text: "Only owners see what a build cost." }
      : spend.loading && !s
        ? { spent: null, text: "Checking…" }
        : s && spentAmt > 0
          ? { spent: true, text: `Yes, ${money(spentAmt)}${s.estimated + s.history > 0 ? " (partly estimated)" : ""}` }
          : sc.id === 6
            ? // The stop itself proves the limit was reached, even when no cost row is readable yet.
              { spent: true, text: `Yes, the full limit for one build${CAPS.perBuildUsd != null ? ` ($${CAPS.perBuildUsd.toFixed(2)})` : ""}` }
            : { spent: false, text: "No spending was recorded for this build" };

  const rounds = timeline.steps.filter((x) => x.kind === "build" && (x.round ?? 0) > 0).length || (typeof r.cycles === "number" ? r.cycles : 0);
  // From the job's own list, else from the run's record (the last check round that failed), in plain words.
  const lastFailedQa = [...timeline.steps].reverse().find((x) => x.kind === "qa" && x.state === "failed");
  const failed = failedChecks(job).length ? failedChecks(job) : (lastFailedQa?.problems ?? []);
  const tried =
    sc.id === 5
      ? `It ran ${rounds} ${rounds === 1 ? "round" : "rounds"} of fixes. ${failed.length === 1 ? "One check still fails" : `${failed.length || "Some"} checks still fail`}, so it handed over to a person, by design.`
      : sc.id === 2
        ? "It wrote the site, then checked every fact against the request, the proposal and your details. Something on the site has no source, so it stopped instead of guessing."
        : sc.id === 6
          ? `It stopped the moment the next step would have gone over its limit. ${d.savedText}`
          : sc.id === 7
            ? `${d.happened} Nothing was saved, so there is nothing to continue from.`
            : sc.id === 8
              ? `${d.happened} ${d.savedText}`
              : d.happened;

  const tech = [
    { k: "job", v: job.id },
    ...(runId ? [{ k: "run", v: runId }] : []),
    ...(status ? [{ k: "status", v: status }] : []),
    ...(job.gh_run_url ? [{ k: "worker log", v: job.gh_run_url }] : []),
  ];
  const c = confirming ? confirmOf(confirming.o) : null;

  return (
    <article className="stopped" aria-labelledby="stop-h">
      <header className="stopped-head">
        <p className="stopped-meta">
          <StatusChip tone="stop">Build stopped</StatusChip>
          <span>{context}</span>
        </p>
        <h1 id="stop-h" className="t-title">
          {sc.title}
        </h1>
      </header>
      <StopFacts spent={moneyFact.spent} money={moneyFact.text} tried={tried} failed={sc.id === 5 ? failed : undefined} who={sc.who ?? undefined} />
      {d.repeating && (
        <Notice tone="caution" title="This keeps happening.">
          The build has now stopped for the same reason three times. Trying again is unlikely to change that.
        </Notice>
      )}
      <FixCard
        primary={primary}
        others={others}
        input={fixInput}
        note={sc.id === 6 ? "Money limits are Nick's decision. The button copies a note with the amount and the reason, for you to send to Nick." : primaryOpt && sc.id !== "factory" ? primaryOpt.hint : undefined}
      >
        {viaForm &&
          (inputs.loading && !inputs.data ? (
            <p className="muted">Checking what you've already given…</p>
          ) : (
            <DetailsForm planId={planId!} needs={open} current={current} unavailable={inputs.data?.unavailable ?? false} busy={busy} requireSomething saveLabel={sc.fix} onSaved={async () => { await inputs.reload(); ask(primaryOpt!, sc.fix); }} />
          ))}
        {(sc.id === 1 || sc.id === 2) && !planId && <Notice tone="caution">This build isn't linked to a proposal, so the details can't be saved here. Add them on the client's page, then build again from there.</Notice>}
      </FixCard>
      {err && !confirming && (
        <Notice tone="stop" title="That didn't work.">
          {err}
        </Notice>
      )}
      {showNote && (
        <div className="field">
          <label htmlFor="stop-note">Copy this note for {showNote} by hand (your browser blocked copying)</label>
          <textarea id="stop-note" className="textarea" readOnly value={note} rows={8} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
      <WhyDisclosure evidence={evidenceOf(job, d)} cropLabel="No screenshot was recorded for this stop" log={report} />
      <TechDetails items={tech} />
      <ConfirmDialog
        open={!!confirming}
        title={c?.title ?? ""}
        body={c?.body ?? ""}
        cost={c?.cost}
        confirmLabel={confirming?.label ?? "Continue"}
        busy={busy}
        error={confirming ? err : null}
        onCancel={() => {
          setConfirming(null);
          setErr(null);
        }}
        onConfirm={() => confirming && void carryOn(confirming.o, confirming.save)}
      />
    </article>
  );
}
