/* Cockpit v2 primitives (docs/design/cockpit-v2, "Cockpit Design System.dc.html", Components).
   Status is always a glyph AND a word; colour is never alone. One primary button per view. */
import { useId, useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Circle, CircleDashed, CircleNotch, Copy, Diamond, MinusCircle, StopCircle, Wrench, type Icon } from "@phosphor-icons/react";
import { useDetail } from "../lib/detail";

/* ---------------- status ---------------- */

export type StatusTone = "need" | "done" | "stop" | "run" | "wait" | "skip" | "idle";

export const TONE_WORD: Record<StatusTone, string> = {
  need: "Needs you",
  done: "Done",
  stop: "Stopped",
  run: "Running",
  wait: "Waiting",
  skip: "Skipped",
  idle: "No build yet",
};

/** The glyph for each state (locked): diamond, tick, stop sign, turning ring, hollow circle, minus, dashed circle. */
export function StatusGlyph({ tone, size }: { tone: StatusTone; size?: number }) {
  const p = { "aria-hidden": true as const, size, className: `glyph glyph-${tone}` };
  switch (tone) {
    case "need":
      return <Diamond weight="fill" {...p} />;
    case "done":
      return <CheckCircle weight="fill" {...p} />;
    case "stop":
      return <StopCircle weight="fill" {...p} />;
    case "run":
      return <CircleNotch weight="bold" {...p} className={`${p.className} spin`} />;
    case "wait":
      return <Circle weight="regular" {...p} />;
    case "skip":
      return <MinusCircle weight="regular" {...p} />;
    case "idle":
      return <CircleDashed weight="regular" {...p} />;
  }
}

/** A status chip: glyph plus word, always. Text, not a button. */
export function StatusChip({ tone, children }: { tone: StatusTone; children?: ReactNode }) {
  return (
    <span className={`chip chip-${tone}`}>
      <StatusGlyph tone={tone} />
      {children ?? TONE_WORD[tone]}
    </span>
  );
}

/** The six-step path as segments: done = ink, current = tone colour, running = striped. Decorative: the step is
 *  always written in text beside it. */
export function PathSegments({ step, tone, height = 6, count = 6 }: { step: number; tone: StatusTone; height?: number; count?: number }) {
  return (
    <span className="segs" aria-hidden="true" style={{ ["--seg-h" as string]: `${height}px` }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={i < step ? "seg seg-done" : i === step ? `seg seg-now seg-${tone}` : "seg"} />
      ))}
    </span>
  );
}

/* ---------------- buttons ---------------- */

export type ButtonVariant = "primary" | "secondary" | "quiet";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Page-level primaries are 48–50 px tall. */
  size?: "default" | "page";
  icon?: Icon;
  /** Trailing icon (the design's arrow on primaries). */
  iconAfter?: Icon;
}

export function Button({ variant = "secondary", size = "default", icon: Lead, iconAfter: Trail, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={["btn", variant, size === "page" ? "btn-page" : "", className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {Lead && <Lead aria-hidden="true" />}
      {children}
      {Trail && <Trail aria-hidden="true" />}
    </button>
  );
}

export function ButtonLink({ to, variant = "secondary", size = "default", icon: Lead, iconAfter: Trail, children }: { to: string; variant?: ButtonVariant; size?: "default" | "page"; icon?: Icon; iconAfter?: Icon; children: ReactNode }) {
  return (
    <Link to={to} className={["btn", variant, size === "page" ? "btn-page" : ""].filter(Boolean).join(" ")}>
      {Lead && <Lead aria-hidden="true" />}
      {children}
      {Trail && <Trail aria-hidden="true" />}
    </Link>
  );
}

/* ---------------- segmented control ---------------- */

/** Simple/Detailed, Grid/List, Inbox/Preferences. A radiogroup: arrow keys move and choose, one tab stop. */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; icon?: Icon }[]; onChange: (v: T) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} className="segmented">
      {options.map((o, i) => {
        const on = o.value === value;
        const I = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {I && <I aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Inbox/Preferences on Notifications: a tablist with the segmented look. Arrow keys, Home and End move and choose;
 *  each tab controls its own tabpanel (render both panels and hide the inactive one, so aria-controls always resolves). */
export function Tabs<T extends string>({ label, value, options, onChange, idBase }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; idBase: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent, i: number) {
    const last = options.length - 1;
    const n = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (n < 0) return;
    e.preventDefault();
    onChange(options[n].value);
    refs.current[n]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="segmented">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${o.value}`}
            aria-controls={`${idBase}-panel-${o.value}`}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- empty and coming later ---------------- */

/** Says what will appear here and offers the one way to start. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

/** A room that does not exist yet: shows nothing rather than made-up numbers. */
export function ComingLater({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className="coming-later">
      <b>{name}</b> · {children ?? "not built yet, so it shows nothing rather than made-up numbers."}
    </div>
  );
}

/* ---------------- technical details ---------------- */

export interface TechItem {
  k: string;
  v: string;
}

async function copyText(v: string) {
  try {
    await navigator.clipboard?.writeText(v);
  } catch {
    /* the value is on screen to select by hand */
  }
}

/** Native <details>: closed in Simple, open in Detailed (the person can still open or close it). Every id has a
 *  copy button labelled "Copy". The only place engineering words may appear. */
export function TechDetails({ items = [], children, summary = "Technical details" }: { items?: TechItem[]; children?: ReactNode; summary?: string }) {
  const { detailed } = useDetail();
  const base = useId();
  return (
    <details className="tech" open={detailed} key={String(detailed)}>
      <summary>
        <Wrench aria-hidden="true" />
        {summary}
      </summary>
      {items.length > 0 && (
        <dl className="tech-list">
          {items.map((t, i) => (
            <div key={`${t.k}-${i}`}>
              <dt id={`${base}-${i}`}>{t.k}</dt>
              <dd>
                <span className="fig">{t.v}</span>
                <button type="button" className="copy" aria-label="Copy" aria-describedby={`${base}-${i}`} onClick={() => void copyText(t.v)}>
                  <Copy aria-hidden="true" />
                </button>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </details>
  );
}

/* ---------------- wordmark ---------------- */

/** WFACT is a typeset wordmark until a real mark exists (locked decision 6): "WFACT" in Newsreader 600, then
 *  "Cockpit" in Newsreader italic. No glyph tile. */
export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wordmark-a">WFACT</span>
      <span className="wordmark-b">Cockpit</span>
    </span>
  );
}
