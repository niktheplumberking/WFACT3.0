/** Core components. Pre-v2 pieces (Aspect, Notice, Plate, RouteLine) are replaced screen by screen in Cockpit v2;
 *  the v2 primitives live in kit.tsx and flow.tsx. ConfirmDialog and SitePreview here are v2. */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { WarningOctagon, Info, CheckCircle, Warning, ArrowsOut, ArrowsIn, X, Eye } from "@phosphor-icons/react";
import { previewHtml } from "../jobsClient";
import { loadSitePreview, pageForHref, pageLabel, type SitePreviewData } from "../lib/sitePreview";
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
 * Confirmation (Cockpit v2): a native modal <dialog> with role="alertdialog". Newsreader title, a body, and for paid
 * work the money line (rough cost plus the per-build stop, from lib/costs.ts costLine). "Not now" + one primary.
 * Focus goes to the primary on open and back to the opener on close. With `reasonLabel` it also asks for a short
 * reason, required before the primary.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  cost,
  confirmLabel,
  cancelLabel = "Not now",
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
  /** The money sentence for anything that starts paid work. */
  cost?: string;
  confirmLabel: string;
  cancelLabel?: string;
  reasonLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  const [reason, setReason] = useState("");
  const rid = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      setReason("");
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
      (reasonLabel ? reasonRef.current : primary.current)?.focus();
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
      // Focus goes back to the opener. The decision often disables it while it saves (in the same render that closes this
      // dialog), or re-renders the page so it goes (Approve gives way to the approved view); then focus moves to the page
      // itself, never left on <body> or on this closed dialog.
      const back = opener.current as HTMLElement | null;
      const usable = (e: HTMLElement | null) => !!e && e.isConnected && !(e as HTMLButtonElement).disabled;
      if (usable(back)) back!.focus();
      else document.getElementById("main")?.focus();
      if (back && typeof MutationObserver === "function") {
        const mo = new MutationObserver(() => {
          const a = document.activeElement;
          if (a && a !== document.body && !d.contains(a)) {
            if (a !== back) mo.disconnect();
            return;
          }
          mo.disconnect();
          document.getElementById("main")?.focus();
        });
        mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
        setTimeout(() => mo.disconnect(), 15_000);
      }
    }
  }, [open, reasonLabel]);
  const tid = `${rid}-t`;
  const bid = `${rid}-b`;
  return (
    <dialog ref={ref} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={tid} aria-describedby={bid} onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (reasonLabel && reason.trim().length < 3) return;
          onConfirm(reason.trim());
        }}
      >
        <h2 id={tid}>{title}</h2>
        <div id={bid} className="dialog-body">
          <div className="muted">{body}</div>
          {cost && <p className="dialog-cost">{cost}</p>}
        </div>
        {reasonLabel && (
          <div className="field">
            <label htmlFor={`${rid}-r`}>{reasonLabel}</label>
            <input ref={reasonRef} id={`${rid}-r`} className="input" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} required minLength={3} />
          </div>
        )}
        {error && <Notice tone="stop">{error}</Notice>}
        <div className="actions dialog-actions">
          <button className="btn secondary btn-page" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button ref={primary} className={`btn btn-page ${danger ? "danger" : "primary"}`} type="submit" disabled={busy || (!!reasonLabel && reason.trim().length < 3)}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/**
 * The finished site, side by side (Cockpit v2): desktop and phone frames load the same page of the real built site
 * (lib/sitePreview.ts); the page switcher is a tablist. On phones the two stack. Frames are sandboxed WITHOUT
 * allow-same-origin: built pages are model output and can never read the Cockpit's session.
 */
export function SitePreview({ manifestPath, onPage }: { manifestPath: string; onPage?: (page: string) => void }) {
  const [site, setSite] = useState<SitePreviewData | null>(null);
  const [page, setPage] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const pid = useId();

  async function show(s: SitePreviewData, p: string) {
    setError(null);
    try {
      setHtml(await s.render(p));
      setPage(p);
      onPage?.(p);
    } catch (e) {
      setError(`Couldn't load ${pageLabel(p)}: ${e instanceof Error ? e.message : String(e)}. Nothing was changed; try again.`);
    }
  }

  useEffect(() => {
    let live = true;
    void loadSitePreview(manifestPath).then((res) => {
      if (!live) return;
      if (!res.data) return setError(`Couldn't load the built site: ${res.error}. Nothing was changed; try again.`);
      setSite(res.data);
      void show(res.data, res.data.pages[0]!);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestPath]);

  if (error && !site) return <Notice tone="stop">{error}</Notice>;
  if (!site) return <Loading rows={2} label="Loading the built site" />;
  const i = Math.max(0, site.pages.indexOf(page ?? ""));
  const pick = (n: number) => {
    const p = site.pages[(n + site.pages.length) % site.pages.length]!;
    void show(site, p);
    tabs.current[(n + site.pages.length) % site.pages.length]?.focus();
  };
  return (
    <div className="siteprev">
      <div role="tablist" aria-label="Pages" className="page-tabs">
        {site.pages.map((p, n) => (
          <button
            key={p}
            ref={(el) => {
              tabs.current[n] = el;
            }}
            role="tab"
            type="button"
            id={`${pid}-t${n}`}
            aria-selected={p === page}
            aria-controls={`${pid}-panel`}
            tabIndex={p === page ? 0 : -1}
            onClick={() => void show(site, p)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") pick(i + 1);
              else if (e.key === "ArrowLeft") pick(i - 1);
            }}
          >
            {pageLabel(p)}
          </button>
        ))}
      </div>
      {error && <Notice tone="stop">{error}</Notice>}
      <div id={`${pid}-panel`} role="tabpanel" aria-labelledby={`${pid}-t${i}`} className="siteprev-frames">
        <figure className="frame-desk">
          <ScaledFrame html={html ?? ""} width={1280} height={800} title={`${page ? pageLabel(page) : ""} on a desktop screen`} />
          <figcaption>Desktop · {page ? pageLabel(page) : ""}</figcaption>
        </figure>
        <figure className="frame-phone">
          <ScaledFrame html={html ?? ""} width={390} height={844} title={`${page ? pageLabel(page) : ""} on a phone`} />
          <figcaption>Phone · {page ? pageLabel(page) : ""}</figcaption>
        </figure>
      </div>
    </div>
  );
}

/** An iframe laid out at a real device width and scaled to fit its box, so the page sees desktop or phone CSS. */
function ScaledFrame({ html, width, height, title }: { html: string; width: number; height: number; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / width || 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={box} className="scaled" style={{ aspectRatio: `${width} / ${height}` }}>
      <iframe title={title} sandbox="allow-scripts" srcDoc={html} style={{ width, height, transform: `scale(${scale})` }} />
    </div>
  );
}

/**
 * A built page, rendered inside the Cockpit. The iframe is sandboxed WITHOUT allow-same-origin: the page
 * gets an opaque origin, so its scripts (animations etc.) run but can never read the Cockpit's signed-in
 * session. Built pages are model output — treat them as untrusted.
 */
export function PagePreview({ path }: { path: string }) {
  // A multi-page site (Track A or B) is checkpointed as its manifest: preview the site itself, never the file list.
  if (path.endsWith("/site.manifest.json")) return <SinglePageSitePreview manifestPath={path} />;
  return <SinglePagePreview path={path} />;
}

function SinglePageSitePreview({ manifestPath }: { manifestPath: string }) {
  const [site, setSite] = useState<SitePreviewData | null>(null);
  const [page, setPage] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [full, setFull] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const selectId = useId();

  async function show(s: SitePreviewData, p: string) {
    setLoading(true);
    setError(null);
    try {
      setHtml(await s.render(p));
      setPage(p);
    } catch (e) {
      setError(`Couldn't load ${pageLabel(p)}: ${e instanceof Error ? e.message : String(e)}. Nothing was changed; try again.`);
    }
    setLoading(false);
  }

  async function open() {
    setLoading(true);
    setError(null);
    const res = await loadSitePreview(manifestPath);
    setLoading(false);
    if (!res.data) return setError(`Couldn't load the built site: ${res.error}. Nothing was changed; try again.`);
    setSite(res.data);
    await show(res.data, res.data.pages[0]!);
  }

  // Links inside the site arrive as messages from its frame (and only from it): a known page is shown, anything else is ignored.
  useEffect(() => {
    if (!site) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const href = (e.data as { wfactPreviewHref?: unknown } | null)?.wfactPreviewHref;
      if (typeof href !== "string") return;
      const target = pageForHref(href, site.pages);
      if (target) void show(site, target);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [site]);

  if (!site || html === null) {
    return (
      <div className="stack-tight">
        <div>
          <button className="btn" type="button" disabled={loading} onClick={open}>
            <Eye aria-hidden="true" />
            {loading ? "Loading…" : "Preview the built site"}
          </button>
        </div>
        {error && <Notice tone="stop">{error}</Notice>}
      </div>
    );
  }
  return (
    <div className={full ? "preview full" : "preview"}>
      <div className="actions">
        <label htmlFor={selectId} className="quiet">
          Page
        </label>
        <select id={selectId} className="input" style={{ width: "auto" }} value={page ?? ""} disabled={loading} onChange={(e) => void show(site, e.target.value)}>
          {site.pages.map((p) => (
            <option key={p} value={p}>
              {pageLabel(p)}
            </option>
          ))}
        </select>
        <button className="btn small" type="button" onClick={() => setFull(!full)}>
          {full ? <ArrowsIn aria-hidden="true" /> : <ArrowsOut aria-hidden="true" />}
          {full ? "Exit full screen" : "Full screen"}
        </button>
        <button className="btn small ghost" type="button" onClick={() => { setSite(null); setHtml(null); setFull(false); }}>
          <X aria-hidden="true" />
          Close preview
        </button>
      </div>
      {error && <Notice tone="stop">{error}</Notice>}
      <iframe ref={frame} key={page ?? ""} title={`Preview of the built site: ${page ? pageLabel(page) : ""}`} sandbox="allow-scripts" srcDoc={html} />
      <p className="quiet fine" style={{ margin: 0 }}>
        The pages as built: words, layout, colours, fonts and logo. Motion and interactive parts play on a real preview link, not here. Links switch the page here; forms don't send.
      </p>
    </div>
  );
}

function SinglePagePreview({ path }: { path: string }) {
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
