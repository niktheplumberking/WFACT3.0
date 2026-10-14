/**
 * The finished site review (Cockpit v2, brief §7.9): two chips (every check passed, and whether it is ready to launch), the
 * title, the site itself (page tabs, desktop and phone), the placeholder pictures with what each should show and "Add the
 * picture", the owner-only "launch with placeholders" tick, a readiness line, Technical details, and a sticky bar with
 * "Approve the site" (owner only).
 *
 * Honest limits (BLOCKED-ON-NICK.md): nothing records a site approval yet, so "Approve the site" is shown disabled with the
 * reason; nothing turns free text into the next round's instructions, so "Ask for changes" is not offered. Pictures and the
 * tick are saved as before (uploadImage + savePlanInputs, keys asset.image.<slot> and launch.placeholders_ok). A picture
 * added here reaches the site only with the next build, so its slot stays on the readiness count until then.
 */
import { useState } from "react";
import { SealCheck, UploadSimple } from "@phosphor-icons/react";
import { requestJob, type JobRow } from "../jobsClient";
import { uploadImage } from "../lib/brandUpload";
import { fetchPlanInputs, savePlanInputs, type PlanInputRow } from "../lib/inputs";
import { costLine, fetchRunSpend, money, total } from "../lib/costs";
import { checkLabel } from "../lib/timeline";
import { useLoad, useMe, useToast } from "../lib/state";
import { Button, StatusChip, TechDetails } from "./kit";
import { placeholdersOf, type PlaceholderSlot } from "./Placeholders";
import { ConfirmDialog, Notice, PagePreview } from "./ui";

const where = (p: PlaceholderSlot) => (p.page === "index" ? "Home page" : `${p.page.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())} page`);

export interface SiteReviewProps {
  job: JobRow;
  planId: string | null;
  clientName: string;
  onStarted: (jobId: string) => void;
  /** Extra panels from the build (details still needed from the client). */
  children?: React.ReactNode;
}

export function SiteReview({ job, planId, clientName, onStarted, children }: SiteReviewProps) {
  const toast = useToast();
  const me = useMe();
  const owner = me.role === "owner";
  const r = (job.result ?? {}) as Record<string, unknown>;
  const runId = typeof r.workflowRunId === "string" ? r.workflowRunId : null;
  const slots = placeholdersOf(job);
  const inputs = useLoad(() => (planId ? fetchPlanInputs(planId) : Promise.resolve({ rows: [] as PlanInputRow[], unavailable: false })), [planId]);
  const spend = useLoad(() => (owner && runId ? fetchRunSpend(runId) : Promise.resolve(null)), [owner, runId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  // What this page just saved (the database accepted it), shown before the next read comes back.
  const [savedTick, setSavedTick] = useState<boolean | null>(null);
  const [savedSlots, setSavedSlots] = useState<Record<string, true>>({});

  const rows = inputs.data?.rows ?? [];
  const byKey = new Map(rows.map((x) => [x.key, x]));
  const tickRow = byKey.get("launch.placeholders_ok");
  const launchOk = savedTick ?? (tickRow ? !tickRow.waived && tickRow.value === "yes" : r.launchWithPlaceholders === true);
  const added = (s: PlaceholderSlot) => {
    const x = byKey.get(`asset.image.${s.slot}`);
    return savedSlots[s.slot] || (x && !x.waived) ? true : null;
  };
  const addedCount = slots.filter(added).length;
  const ready = slots.length === 0 || launchOk;
  const readiness =
    slots.length === 0
      ? "Ready to launch once you approve."
      : launchOk
        ? `You chose to launch with ${slots.length} placeholder ${slots.length === 1 ? "picture" : "pictures"}.`
        : `Not ready to launch: ${slots.length} placeholder ${slots.length === 1 ? "picture is" : "pictures are"} still on the site.`;

  async function add(s: PlaceholderSlot, file: File | undefined) {
    if (!file || !planId) return;
    setBusy(s.slot);
    setErr(null);
    const up = await uploadImage(file);
    if (!up.ok) {
      setBusy(null);
      return setErr(up.reason);
    }
    const e = await savePlanInputs(planId, [{ kind: "fact", key: `asset.image.${s.slot}`, label: `Picture: ${s.note}`.slice(0, 120), value: JSON.stringify(up.record), waived: false }]);
    setBusy(null);
    if (e) return setErr(e);
    setSavedSlots((m) => ({ ...m, [s.slot]: true }));
    toast("Picture added. It goes on the site with the next build.");
    await inputs.reload();
  }

  async function toggleLaunch(next: boolean) {
    if (!planId) return;
    setBusy("launch");
    setErr(null);
    const e = await savePlanInputs(planId, [{ kind: "fact", key: "launch.placeholders_ok", label: "Launch with placeholder pictures", value: next ? "yes" : null, waived: !next }]);
    setBusy(null);
    if (e) return setErr(e);
    setSavedTick(next);
    toast(next ? "Recorded: this site may launch with its placeholder pictures." : "Recorded: the site won't launch until the pictures are in.");
    await inputs.reload();
  }

  async function rebuild() {
    if (!planId) return;
    setBusy("build");
    setErr(null);
    const { jobId, error } = await requestJob("build_plan", { planId });
    setBusy(null);
    if (!jobId) return setErr(/already in progress/i.test(error ?? "") ? "A build of this site is already running. Your pictures are saved." : `Your pictures are saved, but the build didn't start: ${error}.`);
    setRebuildOpen(false);
    toast("Building again with the client's pictures.");
    onStarted(jobId);
  }

  const checks = (Array.isArray(r.checks) ? r.checks : []) as { checkId: string; passed: boolean }[];
  const rounds = (Array.isArray(r.builderRounds) ? r.builderRounds.length : 0) || (typeof r.cycles === "number" ? r.cycles : 0);
  const spent = spend.data ? total(spend.data) : null;
  const summary = [
    "Technical details",
    [checks.length ? `${checks.length} checks` : null, `${rounds} ${rounds === 1 ? "round" : "rounds"} of fixes`, spent !== null ? money(spent) : null].filter(Boolean).join(", "),
  ].join(": ");
  const sitePath = (r.lastCheckpoint as { path?: string } | null | undefined)?.path ?? null;

  return (
    <div className="review">
      <header className="stopped-head">
        <p className="stopped-meta">
          <StatusChip tone="done">Every check passed</StatusChip>
          <StatusChip tone={ready ? "done" : "need"}>{ready ? "Ready to launch" : "Not ready to launch"}</StatusChip>
        </p>
        <h1 className="t-title">{clientName} is ready for your approval</h1>
      </header>

      {sitePath ? <PagePreview path={sitePath} /> : <Notice tone="caution">This build's record has no saved site to show.</Notice>}

      <section aria-labelledby="ph-h" className="review-ph">
        <h2 id="ph-h" className="t-section">
          Placeholder pictures
        </h2>
        {slots.length === 0 ? (
          <p className="muted">None. Every picture on the site came from the client.</p>
        ) : (
          <>
            <ul className="ph-list">
              {slots.map((s) => {
                const a = added(s);
                return (
                  <li key={s.slot} className="ph-row">
                    <span className="ph-thumb" aria-hidden="true" />
                    <span className="ph-what">
                      <b>{where(s)}</b>
                      <span>Should show: {s.note}</span>
                      {a && <span className="ph-added">Added. It goes on the site with the next build.</span>}
                    </span>
                    {planId && (
                      <label className="btn">
                        <UploadSimple aria-hidden="true" />
                        {busy === s.slot ? "Adding…" : a ? "Replace the picture" : "Add the picture"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!busy} aria-label={`Add the picture for ${where(s)}: ${s.note}`} onChange={(e) => void add(s, e.target.files?.[0])} />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="t-small muted">JPEG, PNG or WebP, up to 2 MB each. The factory never invents or generates the client's pictures.</p>
            {addedCount > 0 && planId && (
              <div>
                <Button disabled={!!busy} onClick={() => setRebuildOpen(true)}>
                  Build again with {addedCount === 1 ? "this picture" : "these pictures"}
                </Button>
              </div>
            )}
            {owner ? (
              <label className="tick">
                <input type="checkbox" checked={launchOk} disabled={!!busy || !planId} onChange={(e) => void toggleLaunch(e.target.checked)} />
                <span>Launch with placeholders. I know a placeholder picture is still on the site, and visitors will see it.</span>
              </label>
            ) : (
              <p className="muted">Only an owner can choose to launch with placeholders.</p>
            )}
          </>
        )}
        <p role="status" className="review-ready">
          {readiness}
        </p>
        {err && <Notice tone="stop">{err}</Notice>}
      </section>

      {children}

      <TechDetails
        summary={summary}
        items={[{ k: "job", v: job.id }, ...(runId ? [{ k: "run", v: runId }] : []), ...(sitePath ? [{ k: "saved site", v: sitePath }] : []), ...(job.gh_run_url ? [{ k: "worker log", v: job.gh_run_url }] : [])]}
      >
        {checks.length > 0 && (
          <ul className="review-checks">
            {checks.map((c) => (
              <li key={c.checkId}>
                <StatusChip tone={c.passed ? "done" : "stop"}>{c.passed ? "Passed" : "Failed"}</StatusChip>
                {checkLabel(c.checkId)}
              </li>
            ))}
          </ul>
        )}
      </TechDetails>

      <div className="review-bar">
        {owner ? (
          <Button variant="primary" size="page" icon={SealCheck} disabled aria-describedby="approve-why">
            Approve the site
          </Button>
        ) : null}
        <p id="approve-why" className="t-small muted">
          {owner
            ? "Off for now: the Cockpit can't record a site approval yet. Nothing here publishes a site."
            : "Only an owner approves the site. A person launches it, outside the Cockpit."}
        </p>
      </div>

      <ConfirmDialog
        open={rebuildOpen}
        title="Build again with the client's pictures?"
        body="This starts a new build from the approved proposal, with the pictures you added. Nothing is published, and this build is kept."
        cost={costLine("one build")}
        confirmLabel="Build again"
        busy={busy === "build"}
        error={rebuildOpen ? err : null}
        onCancel={() => setRebuildOpen(false)}
        onConfirm={() => void rebuild()}
      />
    </div>
  );
}
