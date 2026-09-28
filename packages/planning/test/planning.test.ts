import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry, runAgent } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { MockModelClient } from "@wfact/frontend-loop/modelClient";
import { createIntakeAgent, entityAmbiguity, slugify, INTAKE_ROLE, type IntakeResult } from "../src/intake.js";
import { assemblePlan, createPlannerAgent, PLANNER_ROLE, type ModelPlan } from "../src/planner.js";
import { MockJsonClient } from "../src/modelClient.js";
import { MemoryPlanStore } from "../src/planStore.js";
import { intakeAndPlan, registryWithPlanning, replan, type PlanningDeps } from "../src/pipeline.js";

const TASK = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const RAW_EMAIL = `From: Priya Shah <priya@northlightsigns.example>
To: hello@dreamsign
Subject: new website

Hi DreamSign team — we're Northlight Signs, a small sign-making shop. We need a new homepage that
explains our services and how ordering works, with a way to contact us. Keep it simple and trustworthy.`;

const modelIntake = (over: Partial<Record<string, unknown>> = {}) => ({
  entitySlug: "dreamsign",
  leadType: "new_website",
  clientName: "Northlight Signs",
  projectName: "Northlight Signs homepage",
  goal: "A homepage that explains Northlight's sign services and ordering process.",
  brandNotes: "Simple, trustworthy.",
  requestedSections: ["services", "process", "contact"],
  ambiguities: [],
  ...over,
});

const modelPlan = (over: Partial<ModelPlan> = {}): ModelPlan => ({
  templateId: "clean-agency",
  templateRationale: "Services business, trust-first.",
  projectName: "Northlight Signs homepage",
  goal: "Explain Northlight's sign services and ordering, and invite contact.",
  brandNotes: "Restrained and credible.",
  requiredSections: ["hero", "services"],
  tasks: [
    { role: "front-end-builder", stage: "4_homepage_build", title: "Build the homepage from clean-agency" },
    { role: "qa-evaluator", stage: "7_qa_security", title: "Verify against the 6 registry checks + evaluator" },
  ],
  risks: ["No real photos supplied yet."],
  openQuestions: ["Confirm service list."],
  ...over,
});

const certainIntake = {
  ...modelIntake(),
  entityConfidence: "certain",
  clientSlug: "northlight-signs",
  requestSource: "intake-raw",
  classificationAttempts: 1,
} as IntakeResult;

// ---------------- Intake ----------------

test("intake: raw email → certain entity (model and Hermes' deterministic matcher agree), slug derived deterministically", async () => {
  const model = new MockJsonClient(() => modelIntake());
  const run = await runAgent(createIntakeAgent({ model }), { taskId: TASK, role: INTAKE_ROLE, input: RAW_EMAIL }, { registry: registryWithPlanning() });
  assert.equal(run.status, "completed");
  assert.equal(run.output?.entityConfidence, "certain");
  assert.equal(run.output?.clientSlug, "northlight-signs");
  assert.equal(model.calls.length, 1);
  assert.match(model.calls[0]!.user, /<raw_request>[\s\S]*Northlight[\s\S]*<\/raw_request>/, "raw text is fenced as data");
  assert.equal((model.calls[0]!.schema as { additionalProperties?: unknown }).additionalProperties, false);
});

test("intake: model/deterministic disagreement → re-classified once, resolved on the second pass", async () => {
  const text = "Hello Bennett & Co, we'd like a landing page for our bakery.";
  const model = new MockJsonClient((_, i) => modelIntake({ entitySlug: i === 0 ? "dreamsign" : "bennett-co", clientName: "Crumb Bakery" }));
  const run = await runAgent(createIntakeAgent({ model }), { taskId: TASK, role: INTAKE_ROLE, input: text }, { registry: registryWithPlanning() });
  assert.equal(run.status, "completed");
  assert.equal(run.output?.entitySlug, "bennett-co");
  assert.equal(run.output?.classificationAttempts, 2);
  assert.match(model.calls[1]!.user, /could not settle the entity/);
});

test("intake: still ambiguous after the one re-classification → escalated to a human, never guessed", async () => {
  const model = new MockJsonClient(() => modelIntake({ entitySlug: null }));
  const run = await runAgent(
    createIntakeAgent({ model }),
    { taskId: TASK, role: INTAKE_ROLE, input: "We need a website for our shop, please get in touch." },
    { registry: registryWithPlanning() },
  );
  assert.equal(run.status, "escalated");
  assert.match(run.reason ?? "", /ambiguous/);
  assert.equal(model.calls.length, 2, "exactly one retry of the classification");
});

test("intake: empty / oversized raw input is rejected before any model call", async () => {
  const model = new MockJsonClient(() => modelIntake());
  for (const input of ["   ", "x".repeat(20_001)]) {
    const run = await runAgent(createIntakeAgent({ model }), { taskId: TASK, role: INTAKE_ROLE, input }, { registry: registryWithPlanning() });
    assert.equal(run.status, "rejected");
  }
  assert.equal(model.calls.length, 0);
});

test("entityAmbiguity + slugify are deterministic", () => {
  assert.equal(entityAmbiguity("hi dreamsign", "dreamsign"), null);
  assert.match(entityAmbiguity("hi dreamsign", "acme") ?? "", /unknown entity/);
  assert.equal(slugify("Crumb & Co. Bakery!"), "crumb-co-bakery");
  assert.equal(slugify("123 Signs"), "client-123-signs");
});

// ---------------- Planner ----------------

test("planner: plan brief keeps every client-requested section even if the model drops some, and passes parseBrief", () => {
  const plan = assemblePlan(certainIntake, modelPlan({ requiredSections: ["hero"] }), registryWithPlanning());
  for (const s of ["hero", "services", "process", "contact"]) assert.ok(plan.brief.requiredSections.includes(s), s);
  assert.equal(plan.brief.source, "intake-planner");
  assert.equal(plan.brief.templatePreference, "clean-agency");
  assert.deepEqual(plan.tasks.map((t) => [t.order, t.role]), [[1, "front-end-builder"], [2, "qa-evaluator"]]);
});

test("planner: an unexecutable task list is rejected, retried once, then the run escalates", async () => {
  const reversed = modelPlan({ tasks: [...modelPlan().tasks].reverse() });
  const model = new MockJsonClient(() => reversed);
  const registry = registryWithPlanning();
  const run = await runAgent(
    createPlannerAgent({ model, registry }),
    { taskId: TASK, role: PLANNER_ROLE, input: { intake: certainIntake } },
    { registry, sleep: async () => {} },
  );
  assert.equal(run.status, "escalated");
  assert.match(run.reason ?? "", /expected front-end-builder@4_homepage_build/);
  assert.equal(model.calls.length, 2);
});

test("planner: refuses to plan for an ambiguous entity", async () => {
  const model = new MockJsonClient(() => modelPlan());
  const registry = registryWithPlanning();
  const run = await runAgent(
    createPlannerAgent({ model, registry }),
    { taskId: TASK, role: PLANNER_ROLE, input: { intake: { ...certainIntake, entityConfidence: "ambiguous" } } },
    { registry },
  );
  assert.equal(run.status, "rejected");
  assert.equal(model.calls.length, 0);
});

// ---------------- Pipeline ----------------

function deps(over: Partial<PlanningDeps> = {}) {
  const audit = new InMemoryAuditSink();
  const store = new MemoryPlanStore();
  const intakeModel = new MockJsonClient(() => modelIntake());
  const plannerModel = new MockJsonClient(() => modelPlan());
  return { d: { intakeModel, plannerModel, store, audit, ...over } as PlanningDeps, audit, store, intakeModel, plannerModel };
}

test("pipeline: raw email in → pending owner-approval plan out, no hand-written intermediate structure", async () => {
  const { d, audit, store } = deps();
  const result = await intakeAndPlan(RAW_EMAIL, d);
  assert.equal(result.status, "awaiting_owner_approval");
  const row = await store.get(result.planId!);
  assert.equal(row?.status, "pending", "the pipeline never approves its own plan");
  assert.deepEqual(
    audit.events.filter((e) => e.runId === result.runId).map((e) => `${e.actor}:${e.action}`),
    ["agent:intake:agent.spawn", "agent:intake:agent.complete", "agent:planner:agent.spawn", "agent:planner:agent.complete"],
  );
  // The plan's brief is exactly what Stage 3's builder accepts.
  const builder = createFrontendBuilderAgent({ builderModel: new MockModelClient(() => ""), evaluatorModel: new MockModelClient(() => "") });
  assert.doesNotThrow(() => builder.parseInput({ brief: result.plan!.brief }));
});

test("pipeline: intake/planner are registered at composition — the seed registry is unchanged", () => {
  assert.deepEqual(createSeedRegistry().list().map((d) => d.role), ["front-end-builder", "qa-evaluator"]);
  assert.deepEqual(registryWithPlanning().list().map((d) => d.role), ["front-end-builder", "qa-evaluator", "intake", "planner"]);
});

test("replan: owner rejection → one re-plan carrying the owner's note; a second rejection escalates", async () => {
  const { d, store, plannerModel } = deps();
  const first = await intakeAndPlan(RAW_EMAIL, d);
  store.decide(first.planId!, "rejected", "Use the landing-page template and add a pricing section.");

  const second = await replan(first.planId!, d);
  assert.equal(second.status, "awaiting_owner_approval");
  assert.match(plannerModel.calls.at(-1)!.user, /REJECTED[\s\S]*pricing section/);
  const row2 = await store.get(second.planId!);
  assert.equal(row2?.revision, 2);
  assert.equal(row2?.supersedes, first.planId);

  store.decide(second.planId!, "rejected", "Still not right.");
  const third = await replan(second.planId!, d);
  assert.equal(third.status, "replan_limit_reached");
});

test("replan refuses a plan that wasn't rejected", async () => {
  const { d } = deps();
  const first = await intakeAndPlan(RAW_EMAIL, d);
  await assert.rejects(() => replan(first.planId!, d), /only an owner-rejected plan/);
});
