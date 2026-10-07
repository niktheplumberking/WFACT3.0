import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvalMock } from "@wfact/verification/modelClient";
import { MockJsonClient } from "@wfact/planning/modelClient";
import { MemoryPlanStore } from "@wfact/planning/planStore";
import { MemoryArtifactStore } from "@wfact/workflow";
import { briefForBuild, handleJob, type HandlerDeps } from "../src/handlers.js";
import type { Job } from "../src/jobStore.js";

const FIXTURES = path.join(import.meta.dirname, "..", "..", "verification", "test", "fixtures");
const BROKEN = readFileSync(path.join(FIXTURES, "broken.html"), "utf-8");
const CLEAN = readFileSync(path.join(FIXTURES, "clean.html"), "utf-8").replace(
  '<section id="contact">',
  '<section id="services"><p>What we do.</p></section>\n  <section id="process"><p>How.</p></section>\n  <section id="contact">',
);

const intakeOut = {
  entitySlug: "dreamsign", leadType: "new_website", clientName: "Northlight Signs", projectName: "Northlight homepage",
  goal: "Explain services.", brandNotes: "Calm.", requestedSections: ["services", "process", "contact"], ambiguities: [],
};
const planOut = {
  templateId: "clean-agency", templateRationale: "Trust-first.", projectName: "Northlight homepage", goal: "Explain services.",
  brandNotes: "Calm.", requiredSections: ["hero"], risks: [], openQuestions: [],
  tasks: [
    { role: "front-end-builder", stage: "4_homepage_build", title: "Build" },
    { role: "qa-evaluator", stage: "7_qa_security", title: "Verify" },
  ],
};

function deps(page: string) {
  const audit = new InMemoryAuditSink();
  const planStore = new MemoryPlanStore();
  const artifacts = new MemoryArtifactStore();
  const d: HandlerDeps = {
    planning: {
      intakeModel: new MockJsonClient(() => intakeOut),
      plannerModel: new MockJsonClient(() => planOut),
      store: planStore,
      audit,
    },
    planStore,
    workflow: {
      frontEndAgent: createFrontendBuilderAgent({ builderModel: new BuilderMock(() => page), evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
      qaAgent: createQaEvaluatorAgent({ evaluatorModel: new EvalMock(() => "VERDICT: APPROVED") }),
      registry: createSeedRegistry(),
      audit,
      reader: audit,
      artifacts,
      knownClientSlugs: ["dreamsign-pilot", "northlight-signs", "bennett-co"],
      maxQaRevisions: 1,
    },
    readArtifact: async (p) => artifacts.files.get(p) ?? null,
    repoRoot: path.join(import.meta.dirname, "..", "..", ".."),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: new EvalMock(() => "VERDICT: APPROVED") }),
    audit,
    knownClientSlugs: ["dreamsign-pilot", "bennett-co"],
    ask: async (q) => ({ answer: `echo: ${q}`, sourcesUsed: ["memory/context.md"], needsHuman: false, escalationReason: null }),
  };
  return { d, planStore, artifacts, audit };
}

const job = (kind: Job["kind"], params: Record<string, unknown>): Job => ({ id: crypto.randomUUID(), kind, params, status: "dispatched", createdBy: crypto.randomUUID() });

test("intake job: pasted request → pending plan; result carries the plan id for the Approvals room", async () => {
  const { d, planStore } = deps(CLEAN);
  const out = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  assert.equal(out.ok, true);
  assert.equal(out.result.status, "awaiting_owner_approval");
  const planId = out.result.planId as string;
  assert.equal((await planStore.get(planId))?.status, "pending", "the job never approves its own plan");
});

test("build_plan job refuses a plan that isn't approved — even if the request somehow got past the DB gate", async () => {
  const { d } = deps(CLEAN);
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  const out = await handleJob(job("build_plan", { planId: intake.result.planId }), d);
  assert.equal(out.ok, false);
  assert.match(out.reason ?? "", /only an owner-approved plan is built/);
});

test("build_plan job on an approved plan → verified page stored as an artifact, awaiting launch approval", async () => {
  const { d, planStore, artifacts } = deps(CLEAN);
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  planStore.decide(intake.result.planId as string, "approved", null, "A"); // Step 4B M2: approvals choose a track
  const out = await handleJob(job("build_plan", { planId: intake.result.planId }), d);
  assert.equal(out.ok, true, out.reason ?? "");
  assert.equal(out.result.status, "awaiting_launch_approval");
  assert.equal(out.result.buildTrack, "A");
  assert.ok(artifacts.files.has("clients/northlight-signs/pages/clean-agency.html"));
});

test("Step 4B M2: build_plan refuses an approved plan with no track (a pre-M2 approval), and never builds", async () => {
  const { d, planStore, artifacts } = deps(CLEAN);
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  const id = intake.result.planId as string;
  // Simulates a plan approved before migration 0011 existed: approved, no build_track.
  const row = planStore.rows.get(id)!;
  row.status = "approved";
  const out = await handleJob(job("build_plan", { planId: id }), d);
  assert.equal(out.ok, false);
  assert.match(out.reason ?? "", /no build track/);
  assert.equal(artifacts.files.size, 0);
});

// Changed in Step 4B M4 (was: "refused until the Track B builder exists"). A runner without a Track B
// builder still refuses, and never builds the plan as Track A.
test("Step 4B M4: a Track B plan on a runner with no Track B builder is refused, not built as Track A", async () => {
  const { d, planStore, artifacts } = deps(CLEAN);
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  planStore.decide(intake.result.planId as string, "approved", null, "B");
  const out = await handleJob(job("build_plan", { planId: intake.result.planId }), d);
  assert.equal(out.ok, false);
  assert.match(out.reason ?? "", /no Track B builder configured; it is not built as Track A/);
  assert.equal(artifacts.files.size, 0);
});

test("Step 4B M4: a Track B plan is built by the Track B workflow, and only by it", async () => {
  const { d, planStore, artifacts } = deps(CLEAN);
  let trackBRuns = 0;
  const trackB = {
    ...d.workflow,
    frontEndAgent: {
      ...d.workflow.frontEndAgent,
      execute: async (input: Parameters<typeof d.workflow.frontEndAgent.execute>[0], ctx: Parameters<typeof d.workflow.frontEndAgent.execute>[1]) => {
        trackBRuns += 1;
        return d.workflow.frontEndAgent.execute(input, ctx);
      },
    },
  };
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  planStore.decide(intake.result.planId as string, "approved", null, "B");
  const out = await handleJob(job("build_plan", { planId: intake.result.planId }), { ...d, trackBWorkflow: trackB });
  assert.equal(out.ok, true, out.reason ?? "");
  assert.equal(out.result.buildTrack, "B");
  assert.equal(trackBRuns, 1);
  assert.ok(artifacts.files.size > 0);
});

test("build_plan job with a page QA keeps failing → ok:false with the specific failed checks", async () => {
  const { d, planStore } = deps(BROKEN);
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  planStore.decide(intake.result.planId as string, "approved", null, "A"); // Step 4B M2: approvals choose a track
  const out = await handleJob(job("build_plan", { planId: intake.result.planId }), d);
  assert.equal(out.ok, false);
  assert.equal(out.result.status, "failed_verification");
  assert.ok((out.result.qaIssues as string[]).some((i) => i.startsWith("[")), "issues name the failing check ids");
});

test("replan job only re-plans a rejected plan, carrying the note", async () => {
  const { d, planStore } = deps(CLEAN);
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  planStore.decide(intake.result.planId as string, "rejected", "Use a warmer tone.");
  const out = await handleJob(job("replan", { planId: intake.result.planId }), d);
  assert.equal(out.ok, true);
  assert.notEqual(out.result.planId, intake.result.planId);
});

test("verify job reads the page from the artifact store first, else the repo", async () => {
  const { d, artifacts } = deps(CLEAN);
  artifacts.files.set("clients/northlight-signs/pages/clean-agency.html", CLEAN);
  const fromStore = await handleJob(job("verify", { path: "clients/northlight-signs/pages/clean-agency.html", goal: "g", sections: ["hero", "contact"] }), d);
  assert.equal(fromStore.result.source, "artifact-store");
  assert.equal(fromStore.ok, true);
  const fromRepo = await handleJob(job("verify", { path: "clients/dreamsign-pilot/pages/clean-agency.html", goal: "g" }), d);
  assert.equal(fromRepo.result.source, "repo");
  const missing = await handleJob(job("verify", { path: "clients/nobody/pages/none.html", goal: "g" }), d);
  assert.equal(missing.ok, false);
});

test("ask job returns Hermes' answer and sources", async () => {
  const { d } = deps(CLEAN);
  const out = await handleJob(job("ask", { question: "What stage is DreamSign in?" }), d);
  assert.equal(out.ok, true);
  assert.equal(out.result.answer, "echo: What stage is DreamSign in?");
});

test("malformed params are rejected by the runner too (defence in depth behind the DB trigger)", async () => {
  const { d } = deps(CLEAN);
  await assert.rejects(() => handleJob(job("build_plan", { planId: "$(whoami)" }), d), /must be a UUID/);
  await assert.rejects(() => handleJob(job("verify", { path: "../../etc/passwd", goal: "g" }), d), /clients\/<slug>\/pages/);
});

test("Step 4B M3: a Track A plan is built by the Track A builder into a multi-page site", async () => {
  const { createTrackABuilderAgent } = await import("@wfact/frontend-loop/trackA/agent");
  const content = readFileSync(path.join(import.meta.dirname, "..", "..", "frontend-loop", "test", "fixtures", "track-a", "summit-line.content.json"), "utf-8");
  const { d, planStore, artifacts } = deps(CLEAN);
  d.trackAWorkflow = {
    ...d.workflow,
    frontEndAgent: createTrackABuilderAgent({ builderModel: new BuilderMock(() => content), evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
  };
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  planStore.decide(intake.result.planId as string, "approved", null, "A");
  const out = await handleJob(job("build_plan", { planId: intake.result.planId }), d);
  assert.equal(out.ok, true, out.reason ?? JSON.stringify(out.result.qaIssues));
  const cp = out.result.lastCheckpoint as { path: string };
  assert.match(cp.path, /^clients\/northlight-signs\/sites\/track-a\/site\.manifest\.json$/);
  for (const f of ["index.html", "services.html", "faq.html", "contact.html", "content.json"]) {
    assert.ok(artifacts.files.has(`clients/northlight-signs/sites/track-a/${f}`), f);
  }
  assert.ok(![...artifacts.files.keys()].some((k) => k.includes("/pages/")), "the single-page builder was not used");
});

test("briefForBuild: a plan approved before page scope existed takes it from the lead type; an explicit scope wins", () => {
  const brief = { clientSlug: "harbor-street-bakery", entitySlug: "bennett-co", projectName: "x", goal: "x", requiredSections: [], brandNotes: "x", source: "intake-planner" as const };
  const intake = (leadType: string) => ({ entitySlug: "bennett-co", leadType, requestSource: "cockpit", clientName: "Harbor Street Bakery" });
  assert.equal(briefForBuild({ brief, intake: intake("landing_page") }).pageScope, "single");
  assert.equal(briefForBuild({ brief, intake: intake("new_website") }).pageScope, "multi");
  assert.equal(briefForBuild({ brief: { ...brief, pageScope: "multi" }, intake: intake("landing_page") }).pageScope, "multi");
});

// ---- Step 4D: build recovery ----

import { MemoryPlanInputStore } from "../src/inputStore.js";
import { isTransientReviewerOutage } from "../src/handlers.js";

async function approvedPlan(d: HandlerDeps, planStore: { decide: (id: string, s: "approved", n: null, t: "A") => void }) {
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  const planId = intake.result.planId as string;
  planStore.decide(planId, "approved", null, "A");
  return planId;
}

test("Step 4D: the details an owner added reach the builder as sourced facts, and the result says how many were used", async () => {
  const { d, planStore } = deps(CLEAN);
  const seen: string[] = [];
  d.workflow = { ...d.workflow, frontEndAgent: createFrontendBuilderAgent({ builderModel: new BuilderMock((r) => { seen.push(r.user); return CLEAN; }), evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }) };
  const inputs = new MemoryPlanInputStore();
  d.inputs = inputs;
  const planId = await approvedPlan(d, planStore);
  inputs.rows.push({ planId, kind: "fact", key: "phone", label: "Business phone", value: "0400 111 222", waived: false, createdAt: "2026-10-07T10:00:00Z" });
  inputs.rows.push({ planId, kind: "fact", key: "hours", label: "Opening hours", value: null, waived: true, createdAt: "2026-10-07T10:01:00Z" });
  const out = await handleJob(job("build_plan", { planId }), d);
  assert.equal(out.ok, true, out.reason ?? "");
  assert.match(seen[0]!, /Owner-confirmed fact: Business phone: 0400 111 222/);
  assert.ok(!seen[0]!.includes("Opening hours"), "a waived item is not given to the builder");
  assert.equal(out.result.inputsUsed, 1);
  assert.equal(out.result.inputsWaived, 1);
  assert.deepEqual((out.result.progress as { saved: string }).saved, "verified");
});

test("Step 4D: a newer answer for the same key replaces the older one", async () => {
  const inputs = new MemoryPlanInputStore();
  const planId = crypto.randomUUID();
  inputs.rows.push({ planId, kind: "fact", key: "phone", label: "Phone", value: "OLD", waived: false, createdAt: "2026-10-07T10:00:00Z" });
  inputs.rows.push({ planId, kind: "fact", key: "phone", label: "Phone", value: "NEW", waived: false, createdAt: "2026-10-07T11:00:00Z" });
  const cur = await inputs.current(planId);
  assert.equal(cur.length, 1);
  assert.equal(cur[0]!.value, "NEW");
});

test("Step 4D: a run that stopped at its cap is reopened by a resume job with reopen:true, and keeps its run id", async () => {
  const { d, planStore } = deps(BROKEN);
  const planId = await approvedPlan(d, planStore);
  const failed = await handleJob(job("build_plan", { planId }), d);
  assert.equal(failed.result.status, "failed_verification");
  const runId = failed.result.workflowRunId as string;

  // A plain resume still refuses a halted run...
  const refused = await handleJob(job("resume", { workflowRunId: runId }), d);
  assert.equal(refused.result.status, "already_finished");
  // ...a person's "fix and continue" does not (the builder now returns a good page).
  d.workflow = { ...d.workflow, frontEndAgent: createFrontendBuilderAgent({ builderModel: new BuilderMock(() => CLEAN), evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }) };
  const fixed = await handleJob(job("resume", { workflowRunId: runId, planId, reopen: true, reason: "fix and continue" }), d);
  assert.equal(fixed.ok, true, fixed.reason ?? "");
  assert.equal(fixed.result.workflowRunId, runId);
  assert.equal((fixed.result.progress as { reopens: number }).reopens, 1);
});

test("Step 4D: an exception inside a started run still names the run, so it can be continued", async () => {
  const { d, planStore } = deps(CLEAN);
  const planId = await approvedPlan(d, planStore);
  let boom = true;
  const realWrite = d.workflow.artifacts.write.bind(d.workflow.artifacts);
  d.workflow.artifacts.write = async (rel: string, content: string) => {
    if (boom) throw new Error("artifact upload failed (HTTP 503): service unavailable");
    return realWrite(rel, content);
  };
  const out = await handleJob(job("build_plan", { planId }), d);
  assert.equal(out.ok, false);
  assert.equal(out.result.status, "crashed");
  assert.match(out.reason ?? "", /artifact upload failed \(HTTP 503\)/);
  const runId = out.result.workflowRunId as string;
  assert.match(runId, /^[0-9a-f-]{36}$/);
  assert.equal((out.result.progress as { saved: string }).saved, "none");

  boom = false;
  const again = await handleJob(job("resume", { workflowRunId: runId }), d);
  assert.equal(again.ok, true, again.reason ?? "");
  assert.equal(again.result.workflowRunId, runId);
});

test("Step 4D: only 'everything passed, the reviewer did not answer' is retried by itself; credits, keys and failed checks are not", () => {
  const out = (status: string, reason: string) => ({ ok: false, reason, result: { status } });
  const outage = "deterministic checks passed but a required review could not run (render.design-review: NOT RUN: HTTP 502: upstream_unreachable) — checks alone are not verification";
  assert.equal(isTransientReviewerOutage(out("not_verified_no_evaluator", outage)), true);
  assert.equal(isTransientReviewerOutage(out("not_verified_no_evaluator", outage.replace("HTTP 502: upstream_unreachable", "HTTP 402: credits exhausted"))), false);
  assert.equal(isTransientReviewerOutage(out("not_verified_no_evaluator", "deterministic checks passed but no evaluator model was configured")), false);
  assert.equal(isTransientReviewerOutage(out("failed_verification", outage)), false);
});

test("Step 4D: a reviewer outage is retried (bounded) after the delay, on the saved site, without a new build", async () => {
  const { d, planStore } = deps(CLEAN);
  const realQa = d.workflow.qaAgent;
  let qaCalls = 0;
  const flaky = {
    ...realQa,
    execute: async (...args: Parameters<typeof realQa.execute>) => {
      qaCalls += 1;
      if (qaCalls === 1) {
        return { status: "blocked_no_evaluator", checkResults: [{ checkId: "render.design-review", passed: false, details: ["NOT RUN: HTTP 502: upstream_unreachable"], notRun: true }], evaluator: null, costs: [] } as never;
      }
      return realQa.execute(...args);
    },
  };
  d.workflow = { ...d.workflow, qaAgent: flaky as typeof realQa };
  d.autoHeal = { delaysMs: [0, 0], maxElapsedMs: 60_000 };
  d.sleep = async () => {};
  let builds = 0;
  const builderAgent = d.workflow.frontEndAgent;
  d.workflow.frontEndAgent = { ...builderAgent, execute: async (...a: Parameters<typeof builderAgent.execute>) => { builds += 1; return builderAgent.execute(...a); } };
  const planId = await approvedPlan(d, planStore);
  const out = await handleJob(job("build_plan", { planId }), d);
  assert.equal(out.ok, true, out.reason ?? "");
  assert.equal(out.result.autoRetries, 1);
  assert.equal(qaCalls, 2);
  assert.equal(builds, 1, "the site was not built again");
});

test("Step 4D: a build links its Cockpit job to the run the moment it starts (so a job killed by a timeout can still be continued)", async () => {
  const { d, planStore, audit } = deps(CLEAN);
  const planId = await approvedPlan(d, planStore);
  const j = job("build_plan", { planId });
  const out = await handleJob(j, d);
  const link = audit.events.find((e) => e.action === "job.run");
  assert.ok(link, "job.run row written");
  assert.equal(link!.taskId, j.id);
  assert.equal(link!.runId, out.result.workflowRunId);
});
