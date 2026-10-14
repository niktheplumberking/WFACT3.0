/**
 * DEV ONLY: a fixture page for eyeballing the build timeline without signing in (`npm run dev`, then open
 * /dev-timeline.html). Not part of the production build: vite builds index.html only, and nothing in src imports this.
 * Every row here is SYNTHETIC.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import "@fontsource/overpass/latin-600.css";
import "@fontsource/overpass/latin-700.css";
import "@fontsource/overpass-mono/latin-500.css";
import "../styles/tokens.css";
import "../styles/app.css";
import type { JobRow } from "../jobsClient";
import { BuildTimeline } from "../components/BuildTimeline";
import { RecoveryPanel } from "../components/Recovery";
import { deriveTimeline, estimate, type RunRow } from "../lib/timeline";
import { Plate } from "../components/ui";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const r = (min: number, action: string, payload: Record<string, unknown> = {}): RunRow => ({ action, occurred_at: ago(min), payload });
const round = (t: number, cycle: number, verdict: string, failed: string[] = []): RunRow[] => [
  r(t, "agent.spawn", { role: "front-end-builder" }),
  r(t - 4, "agent.complete", { role: "front-end-builder", durationMs: 240_000 }),
  r(t - 4, "workflow.checkpoint", { stage: "build", cycle }),
  r(t - 4.2, "agent.spawn", { role: "qa-evaluator" }),
  r(t - 6, "verification.decision", { status: verdict, checks: failed.map((checkId) => ({ checkId, passed: false })) }),
  r(t - 6, "agent.complete", { role: "qa-evaluator", durationMs: 108_000 }),
];
const job = (status: JobRow["status"], extra: Partial<JobRow> = {}): JobRow => ({
  id: "dev-job",
  created_at: ago(60),
  kind: "build_plan",
  params: {},
  status,
  started_at: ago(59),
  finished_at: status === "running" ? null : ago(1),
  result: null,
  error: null,
  gh_run_url: null,
  archived_at: null,
  ...extra,
});
const plan = { decidedAt: ago(70), track: "A" };

const running = deriveTimeline({
  rows: [r(30, "workflow.start", { maxQaRevisions: 2 }), r(29.9, "workflow.preflight", { ok: true, needs: [], checks: [] }), ...round(29.5, 0, "changes_requested", ["claims.unsourced-fact", "render.perf"]), r(23, "workflow.return_to_builder", { cycle: 0 }), r(22.8, "agent.spawn", { role: "front-end-builder" }), r(18, "agent.complete", { role: "front-end-builder", durationMs: 288_000 }), r(18, "workflow.checkpoint", { stage: "build", cycle: 1 }), r(7, "agent.spawn", { role: "qa-evaluator" })],
  job: job("running"),
  plan,
  active: true,
});

const failedRows = [
  r(58, "workflow.start", { maxQaRevisions: 2 }),
  ...round(57, 0, "changes_requested", ["claims.unsourced-fact"]),
  r(50, "workflow.return_to_builder", { cycle: 0 }),
  ...round(49, 1, "changes_requested", ["render.perf", "render.design-review"]),
  r(42, "workflow.return_to_builder", { cycle: 1 }),
  ...round(41, 2, "changes_requested", ["render.perf"]),
  r(34, "workflow.halt", { status: "failed_verification", stage: "qa" }),
];
const failedJob = job("failed", { error: "QA still failing after 2 revision(s)", result: { status: "failed_verification", workflowRunId: "00000000-0000-4000-8000-00000000dev1", progress: { saved: "built" }, qaIssues: [] } });
const failed = deriveTimeline({ rows: failedRows, job: failedJob, plan });

const reopened = deriveTimeline({
  rows: [...failedRows, r(20, "workflow.reopen", { by: "auto", baseCycle: 2, fromStep: "revise" }), r(19.8, "agent.spawn", { role: "front-end-builder" }), r(16, "agent.complete", { role: "front-end-builder", durationMs: 228_000 }), r(16, "workflow.checkpoint", { stage: "build", cycle: 3 }), r(15.8, "agent.spawn", { role: "qa-evaluator" }), r(14, "verification.decision", { status: "approved", checks: [] }), r(14, "agent.complete", { role: "qa-evaluator", durationMs: 108_000 }), r(14, "workflow.gate", {})],
  job: job("succeeded", { kind: "resume" }),
  plan,
});

const needsJob = job("failed", { result: { status: "needs_input", workflowRunId: "00000000-0000-4000-8000-00000000dev2", preflight: { ok: false, needs: [{ key: "logo", label: "Logo file", reason: "The plan uses the client's logo." }, { key: "phone", label: "Business phone number", reason: "Shown on every page." }] } } });
const needs = deriveTimeline({
  rows: [r(5, "workflow.start", { maxQaRevisions: 2 }), r(4.9, "workflow.preflight", { ok: false, needs: [{ key: "logo", label: "Logo file" }, { key: "phone", label: "Business phone number" }], checks: [] }), r(4.9, "workflow.halt", { status: "needs_input", stage: "preflight" })],
  job: needsJob,
  plan,
});

function Harness() {
  return (
    <main className="page stack" style={{ display: "grid", gap: 24 }}>
      <h1>Build timeline fixtures (dev only, synthetic)</h1>
      <Plate title="Build progress (running, stalled quality checks)">
        <div className="plate-body">
          <BuildTimeline timeline={running} startedAt={ago(30)} stats={{ total: estimate([18, 22, 25, 30].map((m) => m * 60_000)), steps: { build: 260_000, qa: 120_000 } }} />
        </div>
      </Plate>
      <RecoveryPanel job={failedJob} siblings={[failedJob]} planId={null} planName="Summit Line Roofing Website" timeline={failed} onChanged={() => {}} onStarted={() => {}} />
      <Plate title="What the factory did (reopened, then passed)">
        <div className="plate-body">
          <BuildTimeline timeline={reopened} />
        </div>
      </Plate>
      <RecoveryPanel job={needsJob} siblings={[needsJob]} planId={null} planName="Summit Line Roofing Website" timeline={needs} onChanged={() => {}} onStarted={() => {}} />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MemoryRouter>
      <Harness />
    </MemoryRouter>
  </React.StrictMode>,
);
