/* Cockpit v2 flow components: the six-step progress strip, live-build step rows, the stop card with its fix, the
   "Why?" disclosure, and the rows of things the site still needs. They render what they are given; deriving it from
   real rows is lib/path.ts, lib/timeline.ts, lib/recovery.ts and lib/inputs.ts. Nothing here invents a state. */
import { useId, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CaretRight, PencilSimple, Paperclip, UploadSimple, User, XCircle, RadioButton, Circle } from "@phosphor-icons/react";
import { Button, PathSegments, StatusChip, StatusGlyph, TechDetails, type StatusTone } from "./kit";

/* ---------------- progress strip ---------------- */

import { STEP_NAMES } from "../lib/path";
export { STEP_NAMES };

export interface StripStep {
  /** One sentence: done = what happened, current = where it stands, later = "Not yet." */
  line: string;
  /** The usual time, from past runs or the design's fixed words. Empty when there is nothing honest to say. */
  usual?: string;
}

export interface NextAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

/** Six columns on desktop; on phones "Step N of 6", segments, the sentence and a disclosure with all six.
 *  Below it: "The one thing to do next" and ONE primary button. */
export function ProgressStrip({ step, tone, steps, nextLine, next, stepWord }: { step: number; tone: StatusTone; steps: StripStep[]; nextLine: string; next?: NextAction; stepWord?: string }) {
  const cells = STEP_NAMES.map((name, i) => {
    const t: StatusTone = i < step ? "done" : i === step ? tone : "wait";
    return { name, i, t, current: i === step, line: steps[i]?.line ?? "Not yet.", usual: steps[i]?.usual ?? "" };
  });
  const here = cells[Math.min(step, 5)];
  return (
    <section aria-label="Progress" className="strip">
      <ol className="strip-cells">
        {cells.map((c) => (
          <li key={c.name} aria-current={c.current ? "step" : undefined} className={c.current ? `cell now now-${c.t}` : "cell"}>
            <div className="cell-head">
              <StatusGlyph tone={c.t} size={18} />
              <span className="cell-n">{String(c.i + 1).padStart(2, "0")}</span>
            </div>
            <p className="cell-name">{c.name}</p>
            <p className="cell-line">{c.line}</p>
            {c.usual && <p className="cell-usual">{c.usual}</p>}
          </li>
        ))}
      </ol>
      <div className="strip-phone">
        <div className="strip-phone-head">
          <span className="t-eyebrow">Step {Math.min(step + 1, 6)} of 6</span>
          <StatusChip tone={tone}>{stepWord}</StatusChip>
        </div>
        <PathSegments step={step} tone={tone} />
        <p className="strip-where">{here.name}</p>
        <p className="muted">{here.line}</p>
        <details className="strip-all">
          <summary>See all six steps</summary>
          <ol>
            {cells.map((c) => (
              <li key={c.name}>
                <StatusGlyph tone={c.t} size={18} />
                <span>
                  <b>{c.name}</b> · <span className="muted">{c.line}</span>
                </span>
              </li>
            ))}
          </ol>
        </details>
      </div>
      <div className="strip-next">
        <div>
          <span className="strip-next-k">The one thing to do next</span>
          <span className="strip-next-v">{nextLine}</span>
        </div>
        {next &&
          (next.href ? (
            <a className="btn primary btn-page" href={next.href}>
              {next.label}
              <ArrowRight aria-hidden="true" />
            </a>
          ) : (
            <Button variant="primary" size="page" iconAfter={ArrowRight} onClick={next.onClick}>
              {next.label}
            </Button>
          ))}
      </div>
    </section>
  );
}

/* ---------------- step row (live build) ---------------- */

export interface CheckResult {
  label: string;
  tone: StatusTone;
  /** The check id, shown beside the plain name in Detailed only. */
  slug?: string;
}

/** Number, title, time ("x so far" / took / "Usually …"), chip, sentence, optional per-check list.
 *  The running row is raised; a stopped row gets the stop wash. */
export function StepRow({ n, title, time, tone, word, sentence, checks, showSlugs, children }: { n: number; title: string; time?: string; tone: StatusTone; word?: string; sentence?: ReactNode; checks?: CheckResult[]; showSlugs?: boolean; children?: ReactNode }) {
  return (
    <li className={`steprow steprow-${tone}`}>
      <span className="steprow-n">{String(n).padStart(2, "0")}</span>
      <div className="steprow-head">
        <span className="steprow-title">{title}</span>
        {time && <span className="steprow-time">{time}</span>}
        <StatusChip tone={tone}>{word}</StatusChip>
      </div>
      {sentence && <p className="steprow-sentence">{sentence}</p>}
      {checks && checks.length > 0 && (
        <ul className="steprow-checks">
          {checks.map((c) => (
            <li key={c.label}>
              <span>
                {c.label}
                {showSlugs && c.slug && <span className="fig quiet"> {c.slug}</span>}
              </span>
              <StatusChip tone={c.tone} />
            </li>
          ))}
        </ul>
      )}
      {children && <div className="steprow-more">{children}</div>}
    </li>
  );
}

/* ---------------- stop: facts, fix, why ---------------- */

/** The facts that always come before a fix: was money spent, and what the factory already tried. */
export function StopFacts({ spent, money, tried, failed, who }: { spent: boolean; money: string; tried: ReactNode; failed?: string[]; who?: ReactNode }) {
  return (
    <>
      <dl className="stop-facts">
        <div className="fact-money">
          <dt>Was money spent?</dt>
          <dd>
            <StatusChip tone={spent ? "need" : "done"}>{spent ? "Money was spent" : "Nothing spent"}</StatusChip>
            <span className="t-label">{money}</span>
          </dd>
        </div>
        <div className="fact-tried">
          <dt>What the factory already tried</dt>
          <dd>{tried}</dd>
        </div>
      </dl>
      {failed && failed.length > 0 && (
        <section className="stop-failed" aria-label="Checks that still fail">
          <h2 className="t-label">Checks that still fail</h2>
          <ul>
            {failed.map((f) => (
              <li key={f}>
                <XCircle weight="fill" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}
      {who && (
        <p className="stop-who">
          <User aria-hidden="true" />
          <span>{who}</span>
        </p>
      )}
    </>
  );
}

export interface FixChoice {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/** "Add the real X" / "Build without it": a radiogroup with an inline field under the first choice. */
export interface FixInput {
  addLabel: string;
  fieldLabel: string;
  withoutLabel: string;
  withoutNote: string;
  mode: "add" | "without";
  value: string;
  inputMode?: "text" | "tel" | "email" | "url";
  onMode: (m: "add" | "without") => void;
  onValue: (v: string) => void;
}

/** "The fix": one primary (continueOptions()[0]), an optional secondary (owner-only actions), quiet alternatives. */
export function FixCard({ primary, secondary, others = [], input, note, children }: { primary: FixChoice; secondary?: FixChoice; others?: FixChoice[]; input?: FixInput; note?: ReactNode; children?: ReactNode }) {
  const hid = useId();
  return (
    <section aria-labelledby={hid} className="fixcard">
      <h2 id={hid} className="t-section">
        The fix
      </h2>
      {input && <FixRadios input={input} />}
      {note && <p className="muted">{note}</p>}
      {children}
      <div className="fix-actions">
        <Button variant="primary" size="page" onClick={primary.onClick} disabled={primary.disabled}>
          {primary.label}
        </Button>
        {secondary && (
          <Button size="page" onClick={secondary.onClick} disabled={secondary.disabled}>
            {secondary.label}
          </Button>
        )}
        {others.map((o) => (
          <Button key={o.label} variant="quiet" onClick={o.onClick} disabled={o.disabled}>
            {o.label}
          </Button>
        ))}
      </div>
    </section>
  );
}

function FixRadios({ input }: { input: FixInput }) {
  const fid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const modes = ["add", "without"] as const;
  const key = (e: React.KeyboardEvent, i: number) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const n = (i + 1) % 2;
    input.onMode(modes[n]);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="How to fix it" className="fix-radios">
      {modes.map((m, i) => {
        const on = input.mode === m;
        return (
          <div key={m} className="fix-radio">
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => input.onMode(m)}
              onKeyDown={(e) => key(e, i)}
            >
              {on ? <RadioButton weight="fill" aria-hidden="true" /> : <Circle aria-hidden="true" />}
              {m === "add" ? input.addLabel : input.withoutLabel}
            </button>
            {on && m === "add" && (
              <>
                <label htmlFor={fid} className="sr-only">
                  {input.fieldLabel}
                </label>
                <input id={fid} className="input" inputMode={input.inputMode} value={input.value} placeholder="Exactly as it should appear" onChange={(e) => input.onValue(e.target.value)} />
              </>
            )}
            {on && m === "without" && <p className="muted fix-without">{input.withoutNote}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** "Why?": the evidence in plain words, a screenshot crop slot, then Technical details holding the raw log. */
export function WhyDisclosure({ evidence, crop, cropLabel, log, initiallyOpen = false }: { evidence: ReactNode; crop?: ReactNode; cropLabel: string; log?: string; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const rid = useId();
  return (
    <section className="why">
      <button type="button" className="why-toggle" aria-expanded={open} aria-controls={rid} onClick={() => setOpen(!open)}>
        <CaretRight aria-hidden="true" className={open ? "turned" : undefined} />
        Why?
      </button>
      {open && (
        <div id={rid} className="why-body enter">
          <div className="why-grid">
            <p>{evidence}</p>
            <div className="why-crop" role="img" aria-label={cropLabel}>
              {crop ?? <span className="fig">{cropLabel}</span>}
            </div>
          </div>
          {log && (
            <TechDetails>
              <pre className="tech-log">{log}</pre>
            </TechDetails>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------- what the site still needs ---------------- */

export type NeedState = "open" | "done" | "skipped";

export interface NeedRowProps {
  label: string;
  /** One line on why: what it is for, and for a picture, what it should show. */
  why: string;
  kind: "file" | "text";
  state: NeedState;
  /** Done: the file name or the value. */
  value?: string;
  /** File types the picker offers. */
  accept?: string;
  onFile?: (f: File) => void;
  onAnswer?: (v: string) => void;
  onSkip: () => void;
  onChange: () => void;
  busy?: boolean;
}

/** One thing the client never gave us. Upload / Answer / "Build without it"; done shows the value and Change;
 *  skipped shows "Add it after all". Skipping means left out, never made up. */
export function NeedRow({ label, why, kind, state, value, accept, onFile, onAnswer, onSkip, onChange, busy }: NeedRowProps) {
  const [answering, setAnswering] = useState(false);
  const [text, setText] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const aid = useId();
  const chip: { tone: StatusTone; word: string } =
    state === "done" ? { tone: "done", word: kind === "file" ? "Supplied" : "Answered" } : state === "skipped" ? { tone: "skip", word: "Left out" } : { tone: "need", word: kind === "file" ? "Needs a file" : "Needs an answer" };
  return (
    <li className="needrow">
      <div className="needrow-main">
        <div className="needrow-head">
          <span className="needrow-label">{label}</span>
          <StatusChip tone={chip.tone}>{chip.word}</StatusChip>
        </div>
        <p className="needrow-why">{why}</p>
        {state === "done" && value && (
          <p className="needrow-value">
            <Paperclip aria-hidden="true" />
            {value}
          </p>
        )}
        {answering && (
          <form
            className="needrow-answer"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              onAnswer?.(text.trim());
              setAnswering(false);
            }}
          >
            <label htmlFor={aid} className="sr-only">
              Your answer: {label}
            </label>
            <textarea id={aid} className="textarea" rows={3} value={text} placeholder="Type it exactly as it should appear on the site." onChange={(e) => setText(e.target.value)} />
            <div className="row-actions">
              <Button variant="primary" type="submit" disabled={busy || !text.trim()}>
                Save
              </Button>
              <Button variant="quiet" onClick={() => setAnswering(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
      <div className="row-actions">
        {state === "open" && !answering && (
          <>
            {kind === "file" ? (
              <>
                <input
                  ref={file}
                  type="file"
                  accept={accept}
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile?.(f);
                    e.target.value = "";
                  }}
                />
                <Button variant="primary" icon={UploadSimple} aria-label={`Upload: ${label}`} disabled={busy} onClick={() => file.current?.click()}>
                  Upload
                </Button>
              </>
            ) : (
              <Button icon={PencilSimple} aria-label={`Answer: ${label}`} disabled={busy} onClick={() => setAnswering(true)}>
                Answer
              </Button>
            )}
            <Button variant="quiet" aria-label={`Build without it: ${label}`} disabled={busy} onClick={onSkip}>
              Build without it
            </Button>
          </>
        )}
        {state === "done" && (
          <Button variant="quiet" aria-label={`Change: ${label}`} disabled={busy} onClick={onChange}>
            Change
          </Button>
        )}
        {state === "skipped" && (
          <Button variant="quiet" aria-label={`Add it after all: ${label}`} disabled={busy} onClick={onChange}>
            Add it after all
          </Button>
        )}
      </div>
    </li>
  );
}
