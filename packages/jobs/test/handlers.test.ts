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
import { handleJob, type HandlerDeps } from "../src/handlers.js";
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

test("Step 4B M2: a Track B plan is refused until the Track B builder exists (M4), not built as Track A", async () => {
  const { d, planStore, artifacts } = deps(CLEAN);
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  planStore.decide(intake.result.planId as string, "approved", null, "B");
  const out = await handleJob(job("build_plan", { planId: intake.result.planId }), d);
  assert.equal(out.ok, false);
  assert.match(out.reason ?? "", /Track B builder is not built yet/);
  assert.equal(artifacts.files.size, 0);
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
