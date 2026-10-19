/**
 * The live build (Cockpit v2): "Now: …", a progress bar and four figures, then the ten steps in the brief's order, mapped
 * from deriveTimeline() (lib/timeline.ts). Only what the run recorded is shown: the readiness check, the builder's
 * rounds, the saved site, the quality checks (with the checks that failed) and the launch gate. Steps the run does not
 * record separately (checking the words, the content review, the design review, the final review) say so: they are
 * waiting, or "not recorded separately", never a made-up result. A hidden status line announces step changes only.
 */
import { useEffect, useRef, useState } from "react";
import { BellRinging, CheckCircle } from "@phosphor-icons/react";
import { StepRow } from "./flow";
import { TechDetails, type StatusTone } from "./kit";
import { Notice } from "./ui";
import { formatMs, stallNote, type Timeline, type TimelineStep } from "../lib/timeline";
import type { BuildStats } from "../lib/buildStats";
import { useDetail } from "../lib/detail";

export const LIVE_ROWS = [
  "Getting ready",
  "Writing the site's words and structure",
  "Checking the words",
  "An independent reviewer reads the content",
  "Building the site",
  "Automatic checks in a real browser",
  "Design review of the screenshots",
  "Final independent review",
  "Rounds of fixes",
  "Ready for your approval",
] as const;

const toneOf = (s: TimelineStep | undefined): StatusTone => (!s ? "wait" : s.state === "done" ? "done" : s.state === "running" ? "run" : s.state === "failed" ? "stop" : s.state === "skipped" ? "skip" : "wait");
const took = (s: TimelineStep | undefined, now: number) =>
  !s ? undefined : s.state === "running" && s.startedAt ? `${formatMs(now - Date.parse(s.startedAt))} so far` : s.durationMs != null ? formatMs(s.durationMs) : undefined;

function useNow(live: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [live]);
  return now;
}

export interface LiveBuildProps {
  timeline: Timeline;
  stats?: BuildStats | null;
  startedAt?: string | null;
  /** When the build finished (for its duration once it is no longer running). */
  finishedAt?: string | null;
  /** Spent so far on this run (owner only: the cost views are owner-only); undefined when not readable. */
  spent?: string;
  tech?: { k: string; v: string }[];
}

export function LiveBuild({ timeline: t, stats, startedAt, finishedAt, spent, tech = [] }: LiveBuildProps) {
  const live = t.outcome === "running" || t.outcome === "waiting";
  const now = useNow(live);
  const { detailed } = useDetail();
  const steps = t.steps.filter((s) => s.kind !== "continued" && s.kind !== "plan");
  const of = (k: TimelineStep["kind"]) => steps.filter((s) => s.kind === k);
  const preflight = of("preflight")[0] ?? of("start")[0];
  const builds = of("build");
  const firstBuild = builds.find((s) => (s.round ?? 0) === 0) ?? builds[0];
  const saved = of("saved")[0];
  const qas = of("qa");
  const firstQa = qas[0];
  const fixes = builds.filter((s) => (s.round ?? 0) > 0);
  const gate = of("gate")[0];
  const max = t.maxRounds;
  const passed = t.outcome === "gate" || t.outcome === "finished";

  // Steps the run does not record separately: "not recorded" once the step after them has finished, else waiting.
  const notRecorded = (after: TimelineStep | undefined): { tone: StatusTone; word?: string; sentence?: string } =>
    after && (after.state === "done" || after.state === "failed") ? { tone: "skip", word: "Not recorded", sentence: "This build does not record this step separately." } : { tone: "wait" };

  // A recorded step, or, once the build has passed, "not recorded" (never "waiting" on a finished build).
  const recorded = (st: TimelineStep | undefined, fallback: string) =>
    !st && passed ? { tone: "skip" as StatusTone, word: "Not recorded", sentence: "This build does not record this step separately." } : { tone: toneOf(st), time: took(st, now), sentence: st?.detail ?? fallback };

  const rows: { title: string; tone: StatusTone; word?: string; time?: string; sentence?: string; checks?: { label: string; tone: StatusTone }[]; extra?: string[] }[] = [
    { title: LIVE_ROWS[0], ...recorded(preflight, "Checking the logo, the pictures and that the AI services answer, before any money is spent."), extra: preflight?.problems },
    { title: LIVE_ROWS[1], ...recorded(firstBuild, "From the client's own request and the approved proposal.") },
    { title: LIVE_ROWS[2], ...notRecorded(saved ?? firstQa) },
    { title: LIVE_ROWS[3], ...notRecorded(saved ?? firstQa) },
    { title: LIVE_ROWS[4], ...recorded(saved, "Turning the approved words into real pages.") },
    { title: LIVE_ROWS[5], ...recorded(firstQa, "Every page, at every screen size."), checks: firstQa?.problems.map((p) => ({ label: p, tone: "stop" as StatusTone })) },
    { title: LIVE_ROWS[6], ...notRecorded(gate ?? qas[qas.length - 1]) },
    { title: LIVE_ROWS[7], ...notRecorded(gate ?? qas[qas.length - 1]) },
    {
      title: LIVE_ROWS[8],
      tone: fixes.some((s) => s.state === "running") ? "run" : fixes.some((s) => s.state === "failed") ? "stop" : fixes.length ? "done" : passed ? "skip" : "wait",
      word: !fixes.length && passed ? "Not needed" : undefined,
      sentence: fixes.length ? undefined : passed ? "Every check passed first time." : "Only when a check fails: the factory fixes that one thing and checks again.",
      extra: fixes.map((s, i) => {
        const check = qas.find((q) => q.round === s.round);
        const result = check ? (check.state === "done" ? "passed" : check.state === "failed" ? `still failing: ${check.problems.join("; ")}` : "being checked") : "not checked yet";
        return `Round ${i + 1}${max ? ` of ${max}` : ""}: ${s.detail ?? "fixing what the checks found"}. Checked again: ${result}.`;
      }),
    },
    { title: LIVE_ROWS[9], tone: passed ? "done" : toneOf(gate), sentence: passed ? "Every check passed. The decision is yours." : "Waiting for every check to pass." },
  ];

  const finished = rows.filter((r) => r.tone === "done" || r.tone === "skip").length;
  const pct = passed ? 100 : Math.round((finished / rows.length) * 100);
  const nowRow = rows.find((r) => r.tone === "run");
  const headline = passed ? "Every check passed" : t.outcome === "halted" || t.outcome === "crashed" ? "Stopped" : nowRow ? `Now: ${nowRow.title.charAt(0).toLowerCase()}${nowRow.title.slice(1)}` : "Waiting for the factory worker to start";
  const end = live ? now : finishedAt ? Date.parse(finishedAt) : null;
  const elapsed = startedAt && end ? formatMs(end - Date.parse(startedAt)) : null;
  const left = stats?.total.kind === "ok" && startedAt ? Math.max(0, stats.total.medianMs - (now - Date.parse(startedAt))) : null;
  const stall = live ? stallNote(t, now, stats?.steps ?? {}) : null;

  // Announce step changes only (never every tick).
  const [announce, setAnnounce] = useState("");
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== null && last.current !== headline) setAnnounce(headline);
    last.current = headline;
  }, [headline]);

  return (
    <div className="live-build">
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <h2 className="t-section">{headline}</h2>
      <div className="meter live-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <dl className="figures live-figures">
        <div>
          <dt>{live ? "Running for" : "Took"}</dt>
          <dd className={elapsed ? "t-figure" : "t-small"}>{elapsed ?? (live ? "Not started" : "Not recorded")}</dd>
        </div>
        <div>
          <dt>Time left</dt>
          <dd className={left === null || !live ? "t-small" : "t-figure"}>{!live ? "Finished" : left === null ? "Not enough past builds to say" : `~${formatMs(left)}`}</dd>
        </div>
        {spent !== undefined && (
          <div>
            <dt>Spent so far</dt>
            <dd className="t-figure">{spent}</dd>
          </div>
        )}
        <div>
          <dt>Rounds of fixes</dt>
          <dd className="t-figure">
            {fixes.length}
            {max ? ` of ${max}` : ""}
          </dd>
        </div>
      </dl>
      {stall && <Notice tone="caution">{stall} Nothing is lost if it stops: what it saved is kept.</Notice>}
      {passed && (
        <p className="live-done">
          <CheckCircle weight="fill" aria-hidden="true" />
          Every check passed. The finished site is ready for your approval. Nothing is published.
        </p>
      )}
      <ol className="steps-v2" aria-label="Build steps">
        {rows.map((r, i) => (
          <StepRow key={r.title} n={i + 1} title={r.title} tone={r.tone} word={r.word} time={r.time} sentence={r.sentence} checks={r.checks} showSlugs={detailed}>
            {r.extra && r.extra.length > 0 && (
              <ul className="step-extra">
                {r.extra.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </StepRow>
        ))}
      </ol>
      {live && (
        <div className="leave">
          <BellRinging aria-hidden="true" />
          <p>You can leave this page. It shows on Home and in Notifications when it finishes or needs you.</p>
        </div>
      )}
      {tech.length > 0 && <TechDetails items={tech} />}
    </div>
  );
}
