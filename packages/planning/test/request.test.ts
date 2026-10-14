/**
 * Build-quality Package 1: the request reaches the brief (by code, never rewritten by a model), the requested list is
 * checked against it, synonym sections collapse, the build stage is named for the whole site, and a failed direction
 * step can be re-run alone. Models mocked; the SYNTHETIC Lanternworks request is the input.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MockJsonClient } from "../src/modelClient.js";
import { MemoryPlanStore } from "../src/planStore.js";
import { intakeAndPlan, replan, rerunDirection, type PlanningDeps } from "../src/pipeline.js";
import { buildTaskTitle, canonicalSections } from "../src/planner.js";

const FX = path.join(import.meta.dirname, "..", "..", "frontend-loop", "test", "fixtures", "lanternworks");
const RAW = readFileSync(path.join(FX, "raw-request.txt"), "utf-8");
const requested = JSON.parse(readFileSync(path.join(FX, "requested.json"), "utf-8"));

const modelIntake = {
  entitySlug: "bennett-co", leadType: "new_website", clientName: "Lanternworks Studio", projectName: "Lanternworks Studio Website",
  goal: "A studio site that sells their services.", brandNotes: "Fixed palette and logo.",
  requestedSections: ["home", "services", "how-we-work", "work", "about", "contact"], ambiguities: [],
  requested: { ...requested, services: [...requested.services, "SEO audits"], teamNotes: "200+ projects" },
};
const modelPlan = {
  templateId: "clean-agency", templateRationale: "Studio.", projectName: "Lanternworks Studio Website", goal: "Sell the studio's services.",
  brandNotes: "Three colours.", requiredSections: ["hero", "services", "process", "contact", "home", "how-we-work", "work", "about"],
  tasks: [{ role: "front-end-builder", stage: "4_homepage_build", title: "Build responsive homepage using clean-agency template" }, { role: "qa-evaluator", stage: "7_qa_security", title: "Verify" }],
  risks: [], openQuestions: [],
};
const direction = {
  niche: "creative-portfolio", nicheQuote: "brand and web design studio", audience: { point: "Small service businesses", quote: "small service businesses" },
  primaryGoal: "enquiry", goalQuote: "a site that actually sells what we do", requirements: [], constraints: [], brandDirection: [],
  recommendedTrack: "B", confidence: 0.8, reasons: ["A design studio needs a motion-rich showcase."], openQuestions: [],
};

function deps(directionModel?: MockJsonClient) {
  const store = new MemoryPlanStore();
  const intakeModel = new MockJsonClient(() => modelIntake);
  const plannerModel = new MockJsonClient(() => modelPlan);
  const d: PlanningDeps = { intakeModel, plannerModel, directionModel, store, audit: null };
  return { d, store, intakeModel, plannerModel };
}

test("intake: the request is stored word for word by code; the requested list is checked and what fails is an ambiguity", async () => {
  const { d, store, plannerModel } = deps();
  const r = await intakeAndPlan({ text: RAW, source: "intake-raw" }, d);
  assert.equal(r.status, "awaiting_owner_approval");
  const brief = (await store.get(r.planId!))!.plan.brief;
  assert.equal(brief.requestText, RAW, "byte-for-byte the request");
  assert.equal(brief.briefBasis, "request");
  assert.deepEqual(brief.requested!.services, ["Brand identity", "Websites", "Ongoing care (monthly updates and small changes)"]);
  assert.equal(brief.requested!.primaryActionLabel, "Book a discovery call");
  assert.equal(brief.requested!.teamNotes, undefined, '"200+ projects" is a claim, never a requested item');
  const open = r.plan!.openQuestions.join("\n");
  assert.match(open, /service "SEO audits" is not in the request word for word/);
  assert.match(open, /team "200\+ projects" reads like a claim/);
  // The Planner never ingests raw client text: its prompt is built from Intake's facts only.
  assert.doesNotMatch(plannerModel.calls[0]!.user, /Priya|SYNTHETIC REHEARSAL REQUEST/);
});

test("intake asks for the requested list and has the output budget for it", async () => {
  const { d, intakeModel } = deps();
  await intakeAndPlan({ text: RAW, source: "intake-raw" }, d);
  assert.match(intakeModel.calls[0]!.system, /requested: what the client explicitly asked for, COPIED in the client's own words/);
  assert.equal(intakeModel.calls[0]!.maxTokens, 2048);
  assert.ok(JSON.stringify(intakeModel.calls[0]!.schema).includes("primaryActionLabel"));
});

test("plan: hero/home and process/how-we-work collapse to one id each; the build task names the whole site", async () => {
  const { d, store } = deps();
  const r = await intakeAndPlan({ text: RAW, source: "intake-raw" }, d);
  const plan = (await store.get(r.planId!))!.plan;
  assert.deepEqual(plan.brief.requiredSections.filter((s) => ["hero", "home", "process", "how-we-work"].includes(s)), ["hero", "process"]);
  assert.equal(plan.tasks[0]!.title, "Build the 6-page site (Home, Services, How we work, Work, About, Contact): Build responsive site using clean-agency template");
  assert.equal(plan.tasks[0]!.stage, "4_homepage_build", "the stage id is the workflow's contract and stays");
});

test("helpers: canonical sections and the build title for a landing page", () => {
  assert.deepEqual(canonicalSections(["Hero", "home", "Our Process", "how-we-work", "faq", "FAQ"]), ["hero", "process", "faq"]);
  assert.equal(buildTaskTitle("Build the homepage", true, []), "Build the landing page: Build the homepage");
  assert.equal(buildTaskTitle("Build homepage", false, []), "Build the multi-page site: Build site");
});

test("re-plan carries the request and the requested list (the request did not change)", async () => {
  const { d, store } = deps();
  const first = await intakeAndPlan({ text: RAW, source: "intake-raw" }, d);
  store.decide(first.planId!, "rejected", "Six pages, no duplicates.");
  const second = await replan(first.planId!, d);
  const brief = (await store.get(second.planId!))!.plan.brief;
  assert.equal(brief.requestText, RAW);
  assert.equal(brief.requested!.primaryActionLabel, "Book a discovery call");
});

test("direction re-run: a pending plan whose direction failed gets one, as a superseding row with the same plan and revision", async () => {
  let fail = true;
  const dm = new MockJsonClient(() => (fail ? new Error("output truncated at max_tokens") : direction));
  const { d, store } = deps(dm);
  const first = await intakeAndPlan({ text: RAW, source: "intake-raw" }, d);
  assert.equal(first.direction, null);
  fail = false;
  const r = await rerunDirection(first.planId!, d);
  assert.equal(r.status, "awaiting_owner_approval", r.reason ?? "");
  assert.notEqual(r.planId, first.planId);
  const before = (await store.get(first.planId!))!;
  const after = (await store.get(r.planId!))!;
  assert.equal(before.status, "superseded");
  assert.equal(after.supersedes, first.planId);
  assert.equal(after.revision, before.revision, "the owner's one re-plan is not used up");
  assert.deepEqual(after.plan, before.plan, "the plan itself is unchanged");
  assert.equal(after.direction?.recommendation.track, "B");
  assert.match(dm.calls.at(-1)!.user, /signal orange #F26B38/, "direction reads the original request");
});

test("direction re-run: refused for a decided plan, and a second failure writes nothing", async () => {
  const { d, store } = deps(new MockJsonClient(() => new Error("API down")));
  const first = await intakeAndPlan({ text: RAW, source: "intake-raw" }, d);
  const failed = await rerunDirection(first.planId!, d);
  assert.equal(failed.status, "direction_failed");
  assert.equal(store.rows.size, 1, "nothing written on failure");
  store.decide(first.planId!, "approved", null, "B");
  const decided = await rerunDirection(first.planId!, d);
  assert.equal(decided.status, "direction_failed");
  assert.match(decided.reason!, /is "approved"; direction is only re-run before the owner decides/);
});

test("direction re-run on an old plan with no request on file uses the text the jobs handler found, else refuses", async () => {
  const { d, store } = deps(new MockJsonClient(() => new Error("down")));
  const first = await intakeAndPlan({ text: RAW, source: "intake-raw" }, d);
  const row = store.rows.get(first.planId!)!;
  delete row.intake.requestText;
  delete row.plan.brief.requestText;
  const none = await rerunDirection(first.planId!, d);
  assert.match(none.reason!, /original request is not on file/);
  const ok = await rerunDirection(first.planId!, { ...d, directionModel: new MockJsonClient(() => direction) }, RAW);
  assert.equal(ok.status, "awaiting_owner_approval", ok.reason ?? "");
});
