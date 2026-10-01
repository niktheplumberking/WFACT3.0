/** Core components of the signal-box panel design system (docs/step-4c/PHASE-1-PROPOSAL.md §4). */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { WarningOctagon, Info, CheckCircle, Warning, ArrowsOut, ArrowsIn, X, Eye } from "@phosphor-icons/react";
import { previewHtml } from "../jobsClient";
import { GATE_STAGES, LAUNCH_STAGE, STAGES, STAGE_SHORT, stageIndex, stageLabel } from "../stages";
import type { Tone } from "../lib/model";

/** Status = lamp + word. Never colour alone. */
export function Aspect({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`aspect ${tone}`}>{children}</span>;
}

export function Notice({ tone, title, children }: { tone: "stop" | "caution" | "info" | "clear"; title?: string; children: ReactNode }) {
  const Icon = tone === "stop" ? WarningOctagon : tone === "caution" ? Warning : tone === "clear" ? CheckCircle : Info;
  return (
    <div className={`notice ${tone}`} role={tone === "stop" ? "alert" : undefined}>
      <Icon aria-hidden="true" />
      <div>
        {title && <b>{title} </b>}
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  );
}

/** Loading: a skeleton in the shape of a list, announced once to screen readers. */
export function Loading({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="plate-body" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ marginBottom: 18 }}>
          <div className="skeleton" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
          <div className="skeleton" style={{ width: `${30 + ((i * 23) % 40)}%`, marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

/** A failed load: what happened, that nothing changed, what to do. */
export function LoadError({ what, error, onRetry }: { what: string; error: string; onRetry?: () => void }) {
  return (
    <Notice tone="stop" title={`Couldn't load ${what}.`}>
      The database answered: “{error}”. Nothing was changed. Check your connection, then try again.
      {onRetry && (
        <div style={{ marginTop: 10 }}>
          <button className="btn small" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </Notice>
  );
}

export function PageHead({ title, lead, kicker, actions, big }: { title: ReactNode; lead?: ReactNode; kicker?: ReactNode; actions?: ReactNode; big?: boolean }) {
  return (
    <div className="page-head">
      <div>
        {kicker && <div className="quiet" style={{ marginBottom: 8 }}>{kicker}</div>}
        <h1 className={big ? "status-line" : undefined}>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </div>
  );
}

export function Plate({ title, note, children, id }: { title: ReactNode; note?: ReactNode; children: ReactNode; id?: string }) {
  const auto = useId();
  const hid = id ?? auto;
  return (
    <section className="plate" aria-labelledby={hid}>
      <div className="plate-head">
        <h2 id={hid}>{title}</h2>
        {note && <span className="quiet">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * The route line: where a client is on the 11 stages, which stages are proven, and which human gate
 * holds it. `waitingAt` lights a yellow signal (a person is needed there). Launch is always a locked signal.
 */
export function RouteLine({ stage, name, waitingAt }: { stage: string; name: string; waitingAt?: string }) {
  const here = Math.max(0, stageIndex(stage));
  const waiting = waitingAt ? stageIndex(waitingAt) : -1;
  const p = ((here + 0.5) / STAGES.length) * 100;
  return (
    <div className="route-wrap">
      <div className="route" role="img" aria-label={`${name}: at ${stageLabel(stage)}, stage ${here + 1} of ${STAGES.length}${waiting >= 0 ? ", waiting for a decision" : ""}`}>
        <span className="proven" style={{ ["--p" as string]: `${p.toFixed(1)}%` }} />
        {STAGES.map((s, i) => {
          if (i === waiting) return <span key={s} className="signal waiting" />;
          if (s === LAUNCH_STAGE) return <span key={s} className="signal locked" />;
          if (GATE_STAGES.includes(s)) return <span key={s} className={`signal${i < here ? " cleared" : ""}`} />;
          return <span key={s} className={`stop-pt${i < here ? " done" : i === here ? " here" : ""}`} />;
        })}
      </div>
      <div className="route-labels" aria-hidden="true">
        {STAGES.map((s, i) => (
          <span key={s} className={i === here ? "on" : undefined}>
            {i === here || i === waiting || s === LAUNCH_STAGE ? STAGE_SHORT[s] : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Confirmation for moves that can't be undone (native <dialog>: focus trap, Escape and focus return are
 * the browser's). With `reasonLabel` it also asks for a short reason, required before Confirm.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  reasonLabel,
  danger,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  reasonLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const rid = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setReason("");
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
  }, [open]);
  const tid = `${rid}-t`;
  return (
    <dialog ref={ref} className="dialog" aria-labelledby={tid} onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (reasonLabel && reason.trim().length < 3) return;
          onConfirm(reason.trim());
        }}
      >
        <h2 id={tid}>{title}</h2>
        <div className="muted">{body}</div>
        {reasonLabel && (
          <div className="field">
            <label htmlFor={`${rid}-r`}>{reasonLabel}</label>
            <input id={`${rid}-r`} className="input" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} required minLength={3} />
          </div>
        )}
        {error && <Notice tone="stop">{error}</Notice>}
        <div className="actions">
          <button className="btn ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className={`btn ${danger ? "danger" : "primary"}`} type="submit" disabled={busy || (!!reasonLabel && reason.trim().length < 3)}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/**
 * A built page, rendered inside the Cockpit. The iframe is sandboxed WITHOUT allow-same-origin: the page
 * gets an opaque origin, so its scripts (animations etc.) run but can never read the Cockpit's signed-in
 * session. Built pages are model output — treat them as untrusted.
 */
export function PagePreview({ path }: { path: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [full, setFull] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await previewHtml(path);
    setLoading(false);
    setHtml(res.html);
    if (res.error) setError(`Couldn't load the built page: ${res.error}. Nothing was changed; try again.`);
  }

  if (html === null) {
    return (
      <div className="stack-tight">
        <div>
          <button className="btn" type="button" disabled={loading} onClick={load}>
            <Eye aria-hidden="true" />
            {loading ? "Loading…" : "Preview the built page"}
          </button>
        </div>
        {error && <Notice tone="stop">{error}</Notice>}
      </div>
    );
  }
  return (
    <div className={full ? "preview full" : "preview"}>
      <div className="actions">
        <span className="fig quiet" style={{ overflowWrap: "anywhere" }}>{path}</span>
        <button className="btn small" type="button" onClick={() => setFull(!full)}>
          {full ? <ArrowsIn aria-hidden="true" /> : <ArrowsOut aria-hidden="true" />}
          {full ? "Exit full screen" : "Full screen"}
        </button>
        <button className="btn small ghost" type="button" onClick={() => { setHtml(null); setFull(false); }}>
          <X aria-hidden="true" />
          Close preview
        </button>
      </div>
      <iframe title={`Preview of ${path}`} sandbox="allow-scripts" srcDoc={html} />
    </div>
  );
}
