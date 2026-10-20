/**
 * Step 4D, the owner's side of a stopped build. Two pieces:
 *
 *   <DetailsForm>       "We need these from the client": the missing details as plain fields (or "skip it"), saved to the
 *                       plan (used by the stopped build).
 *   <ClientNeedsPanel>  what a passing build still needs from the client, with a new build that uses the answers.
 *
 * No technical words on the surface; the raw error and run ids stay in Technical details on the run page.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { requestJob, type JobRow } from "../jobsClient";
import { SLOTS, fetchPlanInputs, savePlanInputs, type NewInput, type PlanInputRow } from "../lib/inputs";
import { diagnoseJob, unansweredNeeds, type Need } from "../lib/recovery";
import { useLoad, useToast } from "../lib/state";
import { LogoUpload } from "./LogoUpload";
import type { LogoRecord } from "../lib/brandUpload";
import { Notice, Plate } from "./ui";

/* ---------------- the form ---------------- */

interface FieldState {
  value: string;
  skip: boolean;
  /** A file need (the logo): the uploaded record, saved as the input's value. */
  logo?: LogoRecord | null;
}

/** The logo record saved as a plan input's value (JSON), or null when it is not one. */
function savedLogo(value: string | null): LogoRecord | null {
  if (!value) return null;
  try {
    const v = JSON.parse(value) as LogoRecord;
    return typeof v?.path === "string" && typeof v?.sha256 === "string" ? v : null;
  } catch {
    return null;
  }
}

/** The logo as a detail the owner can add (plan_inputs key asset.logo, migration 0021). */
export const LOGO_NEED: Need = {
  key: "asset.logo",
  label: "Client's logo",
  hint: "SVG, PNG or WebP, up to 512 KB. It goes in the header, footer and browser tab exactly as supplied.",
  multiline: false,
  why: "",
  kind: "file",
};

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
        next[n.key] = prev[n.key] ?? {
          value: c && !c.waived && n.kind !== "file" ? (c.value ?? "") : "",
          skip: !!c?.waived,
          // A logo already added to this plan shows as added (not as an empty upload asking for it again).
          ...(n.kind === "file" ? { logo: c && !c.waived ? savedLogo(c.value) : null } : {}),
        };
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
        if (!was?.waived) rows.push({ kind: n.kind === "answer" ? "answer" : "fact", key: n.key, label: n.label, value: null, waived: true });
      } else if (n.kind === "file") {
        // The uploaded record (path and fingerprint), checked again by the database and by the build.
        if (f.logo && (was?.waived || savedLogo(was?.value ?? null)?.sha256 !== f.logo.sha256)) {
          rows.push({ kind: "fact", key: n.key, label: n.label, value: JSON.stringify(f.logo), waived: false });
        }
      } else if (value) {
        if (was?.waived || (was?.value ?? "") !== value) rows.push({ kind: n.kind === "answer" ? "answer" : "fact", key: n.key, label: n.label, value, waived: false });
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
        if (n.kind === "file") {
          return (
            <div className="stack-tight" key={n.key}>
              <LogoUpload
                label={n.label}
                hint={`${n.why ? `${n.why} ` : ""}${n.hint}`}
                value={f.logo ?? null}
                disabled={f.skip}
                onChange={(logo) => set({ logo })}
              />
              <label className="row-wrap" style={{ fontWeight: 400, gap: 8 }}>
                <input type="checkbox" checked={f.skip} onChange={(e) => set({ skip: e.target.checked, ...(e.target.checked ? { logo: null } : {}) })} />
                Skip this: build without the logo (the site shows the business name as text)
              </label>
            </div>
          );
        }
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
                if (!jobId) return setErr(/already in progress/i.test(error ?? "") ? "A build of this proposal is already running. Your details are saved." : `Your details are saved, but the build didn't start: ${error}.`);
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
