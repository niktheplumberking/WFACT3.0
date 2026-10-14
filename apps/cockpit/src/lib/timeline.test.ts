/**
 * Build progress UX: the timeline derived from a run's audit rows, the estimate, the stall note and the continue options.
 * Rows are SYNTHETIC but shaped exactly like the engine writes them (packages/workflow/src/buildAndVerify.ts,
 * packages/agent-runtime/src/runAgent.ts, packages/verification/src/verificationLoop.ts).
 */
import { describe, expect, it, vi } from "vitest";
vi.mock("../supabaseClient", () => ({ supabase: {} }));
import type { JobRow } from "../jobsClient";
import { continueOptions, type ContinueInput } from "./recovery";
import { checkLabel, currentWait, deriveTimeline, estimate, estimateText, formatMs, median, progressHint, stallNote, stepMedians, type RunRow, type TimelineStep } from "./timeline";

const T0 = Date.parse("2026-10-14T10:00:00Z");
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();
const row = (min: number, action: string, payload: Record<string, unknown> = {}): RunRow => ({ action, occurred_at: at(min), task_id: null, payload });

const BUILDER = "front-end-builder";
const QA = "qa-evaluator";
const start = (min = 0, max = 2) => row(min, "workflow.start", { maxQaRevisions: max });
const spawn = (min: number, role: string) => row(min, "agent.spawn", { role, maxAttempts: 4 });
const complete = (min: number, role: string, durMin: number) => row(min, "agent.complete", { role, attempts: 1, durationMs: durMin * 60_000 });
const checkpoint = (min: number, cycle: number, stage = "build") => row(min, "workflow.checkpoint", { stage, cycle });
const decision = (min: number, status: string, failed: string[] = []) =>
  row(min, "verification.decision", { status, checks: [...failed.map((checkId) => ({ checkId, passed: false })), { checkId: "seo.title", passed: true }] });
const back = (min: number, cycle: number) => row(min, "workflow.return_to_builder", { cycle, issues: ["[claims.unsourced-fact] phone"], qaStatus: "changes_requested" });

function job(status: JobRow["status"], extra: Partial<JobRow> = {}): JobRow {
  return { id: "j1", created_at: at(-1), kind: "build_plan", params: {}, status, started_at: at(0), finished_at: status === "running" ? null : at(60), result: null, error: null, gh_run_url: null, archived_at: null, ...extra };
}
const labels = (steps: TimelineStep[]) => steps.map((s) => `${s.label}:${s.state}`);

/** One full round: write, save, check. */
function round(t: number, cycle: number, verdict: "approved" | "changes_requested", failed: string[] = []): RunRow[] {
  return [spawn(t, BUILDER), complete(t + 4, BUILDER, 4), checkpoint(t + 4, cycle), spawn(t + 5, QA), decision(t + 7, verdict, failed), complete(t + 7, QA, 2)];
}

describe("deriveTimeline", () => {
  it("a succeeded run: every step done, in order, ending ready for launch approval", () => {
    const rows = [start(), row(0.2, "workflow.preflight", { ok: true, needs: [], checks: [] }), ...round(1, 0, "approved"), checkpoint(8, 0, "verified"), row(8, "workflow.gate", { gate: "launch", tier: "hard-gate" })];
    const t = deriveTimeline({ rows, job: job("succeeded", { result: { status: "awaiting_launch_approval" } }), plan: { decidedAt: at(-10), track: "A" } });
    expect(labels(t.steps)).toEqual(["Plan approved:done", "Ready to build:done", "Writing the site:done", "Saved:done", "Quality checks:done", "Ready for launch approval:done"]);
    expect(t.outcome).toBe("gate");
    expect(t.steps[0]!.detail).toBe("Track A.");
    expect(t.steps[2]!.durationMs).toBe(4 * 60_000);
    expect(t.steps[4]!.detail).toBe("Every check passed.");
    expect(t.current).toBeNull();
    expect(progressHint(t)).toBe("Ready for launch approval");
  });

  it("a run from before the readiness check existed says so instead of inventing a result", () => {
    const t = deriveTimeline({ rows: [start(), ...round(1, 0, "approved"), row(8, "workflow.gate", {})], job: job("succeeded") });
    const pre = t.steps.find((s) => s.kind === "preflight")!;
    expect(pre.state).toBe("skipped");
    expect(pre.detail).toMatch(/started before the readiness check existed/);
  });

  it("a failed_verification run with 3 checks: revision rounds numbered against the cap, stopped at the last quality check", () => {
    const rows = [
      start(0, 2),
      ...round(1, 0, "changes_requested", ["claims.unsourced-fact"]),
      back(8, 0),
      ...round(9, 1, "changes_requested", ["claims.unsourced-fact", "render.perf"]),
      back(16, 1),
      ...round(17, 2, "changes_requested", ["render.perf"]),
      row(24, "workflow.halt", { status: "failed_verification", stage: "qa", reason: "QA still failing after 2 revision(s)", cycles: 3 }),
    ];
    const t = deriveTimeline({ rows, job: job("failed", { result: { status: "failed_verification" } }) });
    expect(t.steps.filter((s) => s.kind === "build").map((s) => s.label)).toEqual(["Writing the site", "Revision round 1 of 2", "Revision round 2 of 2"]);
    expect(t.steps.filter((s) => s.kind === "qa").map((s) => s.label)).toEqual(["Quality checks", "Quality checks on revision 1", "Quality checks on revision 2"]);
    expect(t.outcome).toBe("halted");
    expect(t.haltStatus).toBe("failed_verification");
    expect(t.stoppedIn).toBe("qa");
    expect(t.stopped!.label).toBe("Quality checks on revision 2");
    expect(t.stopped!.state).toBe("failed");
    expect(t.stopped!.problems).toEqual(["Page speed"]);
    expect(t.stopped!.detail).toMatch(/handed over to a person/);
    expect(t.savedSite).toBe(true);
    // Earlier quality checks found problems but were not where it stopped.
    expect(t.steps.filter((s) => s.kind === "qa" && s.state === "failed")).toHaveLength(1);
    expect(t.steps.find((s) => s.label === "Quality checks on revision 1")!.problems).toEqual(["A fact on the site that nobody gave us", "Page speed"]);
    expect(progressHint(t)).toBe("Stopped at quality checks");
  });

  it("a reopened run: two segments, the continue named with who and from where, revision count restarting", () => {
    const rows = [
      start(0, 1),
      ...round(1, 0, "changes_requested", ["render.perf"]),
      back(8, 0),
      ...round(9, 1, "changes_requested", ["render.perf"]),
      row(16, "workflow.halt", { status: "failed_verification", stage: "qa", cycles: 2 }),
      row(30, "workflow.reopen", { by: "user-1", fromStatus: "failed_verification", baseCycle: 1, fromStep: "revise" }),
      spawn(31, BUILDER),
      complete(34, BUILDER, 3),
      checkpoint(34, 2),
      spawn(35, QA),
      decision(37, "approved"),
      complete(37, QA, 2),
      row(37, "workflow.gate", {}),
    ];
    const t = deriveTimeline({ rows, job: job("succeeded", { kind: "resume" }), names: { "user-1": "Nick" } });
    const cont = t.steps.find((s) => s.kind === "continued")!;
    expect(cont.label).toBe("Continued with fixes by Nick");
    expect(t.steps.filter((s) => s.segment === 0).at(-1)!.state).toBe("failed");
    const seg1 = t.steps.filter((s) => s.segment === 1).map((s) => s.label);
    expect(seg1).toEqual(["Continued with fixes by Nick", "Revision round 1 of 1", "Saved revision 1", "Quality checks on revision 1", "Ready for launch approval"]);
    expect(t.outcome).toBe("gate");
    expect(t.stopped).toBeNull();
  });

  it("names the continue for each fromStep, an automatic retry, and the person viewing", () => {
    const base = [start(), ...round(1, 0, "changes_requested", ["render.perf"]), row(8, "workflow.halt", { status: "failed_verification", stage: "qa" })];
    const label = (p: Record<string, unknown>) => deriveTimeline({ rows: [...base, row(9, "workflow.reopen", { baseCycle: 0, ...p })], job: job("running"), active: true, meId: "me" }).steps.find((s) => s.kind === "continued")!.label;
    expect(label({ by: "auto", fromStep: "qa" })).toBe("Continued from quality checks by automatic retry");
    expect(label({ by: "me", fromStep: "rebuild" })).toBe("Built again by you");
    expect(label({ by: "someone-else", fromStep: null })).toBe("Continued by a teammate from the saved site");
  });

  it("a run that crashed mid quality checks: the running step is marked stopped with no halt row", () => {
    const rows = [start(), ...round(1, 0, "approved").slice(0, 4)];
    const t = deriveTimeline({ rows, job: job("failed", { error: "runner crashed before recording a result", finished_at: at(20) }) });
    expect(t.stopped!.kind).toBe("qa");
    expect(t.stopped!.state).toBe("failed");
    expect(t.stopped!.detail).toBe("The worker stopped before reporting. Anything it saved is kept.");
    expect(t.outcome).toBe("crashed");
    expect(t.haltStatus).toBeNull();
    expect(t.stoppedIn).toBe("qa");
    expect(t.savedSite).toBe(true);
  });

  it("a preflight needs_input run: stopped at the readiness check, nothing spent, needs listed", () => {
    const needs = [{ key: "logo", label: "Logo file", reason: "The plan uses the client's logo." }, { key: "phone", label: "Business phone number", reason: "Shown on every page." }];
    const rows = [start(), row(0.1, "workflow.preflight", { ok: false, needs, checks: [{ id: "facts.phone", ok: false, detail: "missing" }] }), row(0.1, "workflow.halt", { status: "needs_input", stage: "preflight", cycles: 0 })];
    const t = deriveTimeline({ rows, job: job("failed", { result: { status: "needs_input" } }) });
    expect(labels(t.steps)).toEqual(["Ready to build:failed"]);
    expect(t.stoppedIn).toBe("preflight");
    expect(t.stopped!.problems).toEqual(["Logo file", "Business phone number"]);
    expect(t.stopped!.detail).toMatch(/Nothing was spent/);
    expect(t.preflightNeeds.map((n) => n.key)).toEqual(["logo", "phone"]);
    expect(t.savedSite).toBe(false);
  });

  it("a provider that wasn't ready: stopped before anything was paid for, the service named", () => {
    const rows = [start(), row(0.1, "workflow.preflight", { ok: false, needs: [], checks: [{ id: "provider.builder", ok: false, detail: "credits exhausted" }] }), row(0.1, "workflow.halt", { status: "provider_unavailable", stage: "preflight" })];
    const t = deriveTimeline({ rows, job: job("failed") });
    expect(t.stoppedIn).toBe("preflight");
    expect(t.stopped!.problems).toEqual(["The site builder wasn't ready: credits exhausted"]);
    expect(t.stopped!.detail).toMatch(/wasn't ready.*Nothing was spent/);
  });

  it("a running run: the current step is marked running, what is left shows as not started, the wait is one sentence", () => {
    const rows = [start(), row(0.1, "workflow.preflight", { ok: true, needs: [], checks: [] }), ...round(1, 0, "changes_requested", ["render.perf"]), back(8, 0), spawn(9, BUILDER), complete(13, BUILDER, 4), checkpoint(13, 1), spawn(14, QA)];
    const t = deriveTimeline({ rows, job: job("running"), active: true });
    expect(t.outcome).toBe("running");
    expect(t.current!.label).toBe("Quality checks on revision 1");
    expect(t.current!.state).toBe("running");
    expect(t.steps.at(-1)).toMatchObject({ label: "Ready for launch approval", state: "pending" });
    expect(currentWait(t, Date.parse(at(15)) + 10_000)).toBe("Checking quality: the automatic checks and the design review (1 min 10 s)");
    expect(progressHint(t)).toBe("Quality checks, round 2 of 3");
    // While the builder runs, saving and the checks are still to come.
    const t2 = deriveTimeline({ rows: rows.slice(0, 3), job: job("running"), active: true });
    expect(labels(t2.steps)).toEqual(["Ready to build:done", "Writing the site:running", "Saved:pending", "Quality checks:pending", "Ready for launch approval:pending"]);
  });

  it("an old resume job's page does not mark a newer job's running step as crashed", () => {
    const rows = [start(), ...round(1, 0, "approved").slice(0, 4), row(40, "workflow.reopen", { by: "auto", baseCycle: 0 }), spawn(41, QA)];
    const t = deriveTimeline({ rows, job: job("failed", { finished_at: at(20) }) });
    expect(t.steps.filter((s) => s.state !== "pending").at(-1)!.state).toBe("running");
    expect(t.outcome).toBe("running");
  });

  it("a job with no audit rows falls back to what the job row says (and says it does)", () => {
    const t = deriveTimeline({ rows: [], job: job("failed", { result: { status: "build_failed" } }) });
    expect(t.fromAudit).toBe(false);
    expect(labels(t.steps)).toEqual(["Writing the site:failed", "Quality checks:skipped"]);
    expect(t.stoppedIn).toBe("build");
    const q = deriveTimeline({ rows: [], job: job("queued"), active: true });
    expect(q.current!.label).toBe("Waiting for the factory worker");
  });
});

describe("estimate and stall", () => {
  it("needs at least 3 past runs: 0 and 2 runs say so, 5 runs give the median", () => {
    expect(estimate([])).toEqual({ kind: "insufficient", runs: 0 });
    expect(estimateText(estimate([600_000, 700_000]))).toBe("Not enough past builds to estimate how long this takes.");
    const e = estimate([10, 12, 20, 9, 30].map((m) => m * 60_000));
    expect(e).toEqual({ kind: "ok", medianMs: 12 * 60_000, runs: 5 });
    expect(estimateText(e)).toBe("A build on this track usually takes about 12 min (median of 5 past builds).");
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("formats time in plain words", () => {
    expect(formatMs(45_000)).toBe("45 s");
    expect(formatMs(70_000)).toBe("1 min 10 s");
    expect(formatMs(120_000)).toBe("2 min");
    expect(formatMs(25 * 60_000 + 5_000)).toBe("25 min");
  });

  it("warns past 2x the step's median, or past 5 minutes for quality checks with no median, naming what it waits on", () => {
    const rows = [start(), ...round(1, 0, "approved").slice(0, 4)];
    const t = deriveTimeline({ rows, job: job("running"), active: true });
    const qaStart = Date.parse(at(6));
    expect(stallNote(t, qaStart + 4 * 60_000, {})).toBeNull();
    expect(stallNote(t, qaStart + 6 * 60_000, {})).toBe("Taking longer than usual: this step has run for 6 min. It is waiting on the quality checks and the design reviewer.");
    expect(stallNote(t, qaStart + 3 * 60_000, { qa: 60_000 })).toMatch(/run for 3 min; it usually takes about 1 min/);
    expect(stallNote(t, qaStart + 90_000, { qa: 60_000 })).toBeNull();
  });

  it("per-step medians need 3 samples per step", () => {
    const rows = [5, 6, 7].map((m) => ({ role: BUILDER, durationMs: String(m * 60_000) })).concat([{ role: QA, durationMs: "60000" }]);
    expect(stepMedians(rows)).toEqual({ build: 6 * 60_000, qa: null });
  });

  it("check ids become plain words, never a bare slug", () => {
    expect(checkLabel("render.design-review")).toBe("Design review");
    expect(checkLabel("tells.some-new-thing")).toBe("Some new thing");
  });
});

describe("continueOptions", () => {
  const base: ContinueInput = { haltStatus: null, stoppedIn: null, saved: "built", canReopen: true, canRerun: true };
  const ids = (c: Partial<ContinueInput>) => continueOptions({ ...base, ...c }).map((o) => `${o.id}:${o.fromStep ?? "-"}:${o.label}${o.confirm ? " (confirm)" : ""}`);

  it("needs_input: fill in the details, then continue (the engine picks)", () => {
    expect(ids({ haltStatus: "needs_input", saved: "none", hasNeeds: true })).toEqual(["details:-:Save the details and continue"]);
  });
  it("failed_verification: fix and continue first, check again without changes second", () => {
    const o = continueOptions({ ...base, haltStatus: "failed_verification" });
    expect(o.map((x) => `${x.id}:${x.fromStep}:${x.primary}`)).toEqual(["revise:revise:true", "qa:qa:false"]);
    expect(o[0]!.label).toBe("Fix and continue");
    expect(o[0]!.hint).toMatch(/saves a full rebuild/);
    expect(o[1]!.label).toBe("Check again without changes");
    // With details to add, the form comes first and its button continues.
    expect(continueOptions({ ...base, haltStatus: "failed_verification", hasNeeds: true })[0]).toMatchObject({ needsDetails: true, label: "Save the details and continue" });
  });
  it("review didn't run, QA couldn't finish, or a crash mid-QA: run the checks again (no builder cost)", () => {
    for (const c of [{ haltStatus: "not_verified_no_evaluator" }, { haltStatus: "qa_failed" }, { haltStatus: null, stoppedIn: "qa" as const }]) {
      expect(ids(c)).toEqual(["qa:qa:Run the quality checks again"]);
    }
  });
  it("build_failed: from the saved site when there is one, otherwise build again with a confirmation", () => {
    expect(ids({ haltStatus: "build_failed" })).toEqual(["revise:revise:Continue from the saved site"]);
    expect(ids({ haltStatus: "build_failed", saved: "none" })).toEqual(["rebuild:rebuild:Build again (confirm)"]);
    expect(ids({ haltStatus: null, stoppedIn: "build", saved: "none" })).toEqual(["rebuild:rebuild:Build again (confirm)"]);
  });
  it("never offers to fix or re-check a site that was never saved", () => {
    for (const s of ["failed_verification", "not_verified_no_evaluator", "qa_failed", "build_failed"]) {
      const o = continueOptions({ ...base, haltStatus: s, saved: "none" });
      expect(o.every((x) => x.fromStep !== "revise" && x.fromStep !== "qa")).toBe(true);
    }
  });
  it("checkpoint_corrupt: a new build of the plan, confirmed", () => {
    expect(ids({ haltStatus: "checkpoint_corrupt", canReopen: false })).toEqual(["rerun:-:Build it again (confirm)"]);
  });
  it("ready for launch approval: nothing to continue", () => {
    expect(ids({ haltStatus: "awaiting_launch_approval", saved: "verified" })).toEqual([]);
  });
  it("provider_unavailable: one Try again, re-sending the stopped job's own fromStep", () => {
    expect(ids({ haltStatus: "provider_unavailable", stoppedIn: "preflight", jobFromStep: "qa" })).toEqual(["retry:qa:Try again"]);
    expect(ids({ haltStatus: "provider_unavailable", jobFromStep: null })).toEqual(["retry:-:Try again"]);
    expect(ids({ haltStatus: "provider_unavailable", cause: "money", causeLabel: "I've added credits, continue" })).toEqual(["retry:-:I've added credits, continue"]);
  });
  it("money and setup stops keep their own words; an unknown or crashed-with-unknown-save run lets the engine pick", () => {
    expect(ids({ haltStatus: "build_failed", saved: "none", cause: "money", causeLabel: "I've added credits, continue" })).toEqual(["rebuild:rebuild:I've added credits, continue (confirm)"]);
    expect(ids({ haltStatus: null, saved: "unknown" })).toEqual(["auto:-:Continue from where it stopped"]);
    expect(ids({ haltStatus: "something_new" })).toEqual(["auto:-:Continue from where it stopped"]);
  });
  it("a run that can't be reopened or rerun offers nothing", () => {
    expect(ids({ haltStatus: "build_failed", canReopen: false, canRerun: false })).toEqual([]);
  });
});
