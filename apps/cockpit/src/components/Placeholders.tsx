/**
 * Pictures still needed from the client (Build-quality Package 3). A passing build lists every media slot that still shows an
 * "Image to come" card. The owner adds the client's photo for a slot (checked here with the build's rules, uploaded to the
 * private client-assets bucket, recorded as plan input asset.image.<slot>; the database and the build check it again), then
 * builds again. Or, knowingly, ticks "launch with placeholders": without that tick the launch check refuses the site.
 */
import { useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import type { JobRow } from "../jobsClient";
import { requestJob } from "../jobsClient";
import { uploadImage } from "../lib/brandUpload";
import { savePlanInputs } from "../lib/inputs";
import { Notice, Plate } from "./ui";
import { useToast } from "../lib/state";

export interface PlaceholderSlot {
  slot: string;
  page: string;
  section: string;
  note: string;
}

export function placeholdersOf(job: JobRow): PlaceholderSlot[] {
  const raw = job.result?.placeholders;
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is PlaceholderSlot => !!p && typeof p === "object" && typeof (p as PlaceholderSlot).slot === "string" && typeof (p as PlaceholderSlot).note === "string");
}

const where = (p: PlaceholderSlot) => (p.page === "index" ? "Home page" : `${p.page.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())} page`);

export function PlaceholdersPanel({ job, planId, onStarted }: { job: JobRow; planId: string | null; onStarted: (jobId: string) => void }) {
  const toast = useToast();
  const slots = placeholdersOf(job);
  const [added, setAdded] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [launchOk, setLaunchOk] = useState(job.result?.launchWithPlaceholders === true);
  if (slots.length === 0 || !planId) return null;
  const remaining = slots.filter((s) => !added[s.slot]).length;

  async function add(slot: PlaceholderSlot, file: File | undefined) {
    if (!file || !planId) return;
    setBusy(slot.slot);
    setErr(null);
    const up = await uploadImage(file);
    if (!up.ok) {
      setBusy(null);
      return setErr(up.reason);
    }
    const e = await savePlanInputs(planId, [{ kind: "fact", key: `asset.image.${slot.slot}`, label: `Picture: ${slot.note}`.slice(0, 120), value: JSON.stringify(up.record), waived: false }]);
    setBusy(null);
    if (e) return setErr(e);
    setAdded((a) => ({ ...a, [slot.slot]: file.name }));
  }

  async function toggleLaunch(next: boolean) {
    if (!planId) return;
    setBusy("launch");
    setErr(null);
    const e = await savePlanInputs(planId, [{ kind: "fact", key: "launch.placeholders_ok", label: "Launch with placeholder pictures", value: next ? "yes" : null, waived: !next }]);
    setBusy(null);
    if (e) return setErr(e);
    setLaunchOk(next);
    toast(next ? "Recorded: this site may launch with its placeholder pictures." : "Recorded: the site won't launch until the pictures are in.");
  }

  async function rebuild() {
    if (!planId) return;
    setBusy("build");
    const { jobId, error } = await requestJob("build_plan", { planId });
    setBusy(null);
    if (!jobId) return setErr(/already in progress/i.test(error ?? "") ? "A build of this plan is already running. Your pictures are saved." : `Your pictures are saved, but the build didn't start: ${error}.`);
    toast("Building again with the client's pictures.");
    onStarted(jobId);
  }

  return (
    <Plate title="Pictures still needed from the client" note="Each one shows as an “Image to come” card on the site until you add it.">
      <div className="plate-body stack-tight">
        <Notice tone={launchOk || remaining === 0 ? "clear" : "caution"}>
          {remaining === 0
            ? "Every picture is added. Build again to put them on the site."
            : launchOk
              ? `You chose to launch with ${remaining} placeholder picture${remaining === 1 ? "" : "s"}.`
              : `Not ready to launch: ${remaining} picture${remaining === 1 ? " is" : "s are"} still needed.`}
        </Notice>
        <ul className="plain stack-tight">
          {slots.map((s) => (
            <li key={s.slot} className="placeholder-row">
              <span>
                <strong>{where(s)}</strong>: {s.note}
                {added[s.slot] && <span className="quiet"> (added: {added[s.slot]})</span>}
              </span>
              <label className="btn">
                <UploadSimple aria-hidden="true" />
                {busy === s.slot ? "Adding…" : added[s.slot] ? "Replace" : "Add picture"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!busy} aria-label={`Add the picture for ${where(s)}: ${s.note}`} onChange={(e) => void add(s, e.target.files?.[0])} />
              </label>
            </li>
          ))}
        </ul>
        <p className="quiet fine">JPEG, PNG or WebP, up to 2 MB each. The factory never invents or generates the client's pictures.</p>
        {Object.keys(added).length > 0 && (
          <div>
            <button className="btn primary" type="button" disabled={!!busy} onClick={() => void rebuild()}>
              {busy === "build" ? "Starting…" : "Build again with these pictures"}
            </button>
          </div>
        )}
        <label className="launch-tick">
          <input type="checkbox" checked={launchOk} disabled={!!busy} onChange={(e) => void toggleLaunch(e.target.checked)} />
          <span>Launch with placeholders: the client knows these pictures will show “Image to come” until they send them.</span>
        </label>
        {err && <Notice tone="stop">{err}</Notice>}
      </div>
    </Plate>
  );
}
