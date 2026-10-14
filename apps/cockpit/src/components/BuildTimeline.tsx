/**
 * One build, step by step (build progress UX, BUILD-SPEED-UX P1). A vertical timeline: what ran, how long each step took,
 * what is running now (live elapsed, the current wait in one sentence, an estimate from past builds, a stall note), and
 * where it stopped, with the ways to carry on placed at that step (`stopSlot`).
 *
 * State is never colour alone: every step has an icon and a state word (visible for "running now" and "stopped here",
 * screen-reader text for the rest). The step running now carries aria-current="step"; step changes are announced once in a
 * polite live region, never the ticking seconds.
 */
import type { ReactNode } from "react";
import { CheckCircle, Circle, MinusCircle, WarningCircle, XCircle } from "@phosphor-icons/react";
import { clock } from "../lib/model";
import { currentWait, estimateText, formatMs, stallNote, type Timeline, type TimelineStep } from "../lib/timeline";
import type { BuildStats } from "../lib/buildStats";
import { useNow } from "../lib/useNow";
import { Notice } from "./ui";

const STATE_WORD: Record<TimelineStep["state"], string> = {
  done: "Done",
  running: "Running now",
  failed: "Stopped here",
  skipped: "Skipped",
  pending: "Not started yet",
};

/** A quality check that finished but sent work back: done, yet not a pass. */
const found = (s: TimelineStep) => s.kind === "qa" && s.state === "done" && s.problems.length > 0;

function Mark({ s }: { s: TimelineStep }) {
  switch (s.state) {
    case "done":
      return found(s) ? <WarningCircle weight="fill" aria-hidden="true" /> : <CheckCircle weight="fill" aria-hidden="true" />;
    case "failed":
      return <XCircle weight="fill" aria-hidden="true" />;
    case "skipped":
      return <MinusCircle aria-hidden="true" />;
    case "running":
      return <span className="tl-lamp" aria-hidden="true" />;
    default:
      return <Circle aria-hidden="true" />;
  }
}

function when(s: TimelineStep, now: number): ReactNode {
  if (s.state === "running" && s.startedAt) return <span className="tl-time fig">{formatMs(now - new Date(s.startedAt).getTime())}</span>;
  if (s.state === "pending" || s.state === "skipped" || !s.startedAt) return null;
  const d = s.durationMs !== null && s.durationMs >= 1000 ? formatMs(s.durationMs) : null;
  return (
    <span className="tl-time fig">
      <time dateTime={s.startedAt}>{clock(s.startedAt)}</time>
      {d ? <span className="tl-dur">{d}</span> : null}
    </span>
  );
}

function announcement(t: Timeline): string {
  if (t.current) return `Now: ${t.current.label}.`;
  if (t.outcome === "gate") return "Ready for launch approval.";
  if (t.stopped) return `Stopped at ${t.stopped.label}.`;
  return "";
}

export function BuildTimeline({
  timeline: t,
  stats,
  startedAt,
  stopSlot,
  label = "Build steps",
}: {
  timeline: Timeline;
  /** Past builds of the same track, for the estimate and the stall note (null while loading or not applicable). */
  stats?: BuildStats | null;
  /** When the job started (for the total elapsed). */
  startedAt?: string | null;
  /** Rendered inside the step the build stopped at: what to do next. */
  stopSlot?: ReactNode;
  label?: string;
}) {
  const live = t.outcome === "running" || t.outcome === "waiting";
  const now = useNow(live);
  const wait = live ? currentWait(t, now) : null;
  const stall = live ? stallNote(t, now, stats?.steps ?? {}) : null;
  const total = live && startedAt ? formatMs(now - new Date(startedAt).getTime()) : null;
  return (
    <div className="tl-wrap">
      {live && (
        <div className="tl-now">
          <p className="tl-wait">
            <span className="tl-lamp" aria-hidden="true" />
            <span>{wait}</span>
          </p>
          <p className="quiet fine">
            {total ? <>Running for <span className="fig">{total}</span> in total. </> : null}
            {stats ? estimateText(stats.total) : null} This page updates every few seconds.
          </p>
          {stall && <Notice tone="caution">{stall} Nothing is lost if it stops: what it saved is kept.</Notice>}
        </div>
      )}
      <ol className="timeline" aria-label={label}>
        {t.steps.map((s) =>
          s.kind === "continued" ? (
            <li key={s.key} className="tl-seg">
              <span>{s.label}</span>
              {s.startedAt && <time className="fig quiet" dateTime={s.startedAt}>{clock(s.startedAt)}</time>}
            </li>
          ) : (
            <li key={s.key} className={`tl ${s.state}${found(s) ? " found" : ""}`} aria-current={s === t.current ? "step" : undefined}>
              <span className="tl-mark">
                <Mark s={s} />
              </span>
              <div className="tl-body">
                <div className="tl-head">
                  <b>{s.label}</b>
                  {s.state === "running" || s.state === "failed" ? <span className="tl-state">{STATE_WORD[s.state]}</span> : <span className="sr-only">{found(s) ? "Done, found problems" : STATE_WORD[s.state]}</span>}
                  {when(s, now)}
                </div>
                {s.detail && <p className="tl-detail">{s.detail}</p>}
                {(s.notes ?? []).length > 0 && (
                  <p className="quiet fine tl-notes" style={{ margin: "4px 0 0" }}>
                    Notes, not blocking: {s.notes!.join("; ")}.
                  </p>
                )}
                {s.problems.length > 0 && (
                  <ul className="tl-problems" aria-label={s.kind === "preflight" ? "Missing details" : "What the checks found"}>
                    {s.problems.slice(0, 8).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                    {s.problems.length > 8 && <li className="quiet">and {s.problems.length - 8} more</li>}
                  </ul>
                )}
                {s === t.stopped && stopSlot ? <div className="tl-slot">{stopSlot}</div> : null}
              </div>
            </li>
          ),
        )}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement(t)}
      </p>
    </div>
  );
}
