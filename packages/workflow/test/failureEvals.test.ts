/**
 * Failure-mode evals (2026-10-15). Every case replays a way real Cockpit builds failed, and failed AGAIN when continued,
 * so the factory paid for the same failure more than once. Each eval states the job it comes from and what must hold now:
 * either the build passes, or it stops early and refuses to pay for a result it already knows.
 *
 *   E1  d3c45995  claims gate rejected the owner's real quotes ("needs a SAMPLE label") while the builder's rulebook forbids
 *                 SAMPLE quotes: a rule contradiction no revision can satisfy.
 *   E2  d3c45995, e2a204fb  the same deterministic failure survived a revision unchanged, then the run paid for another.
 *   E3  e2a204fb → 55ddba7c  a continue with nothing changed (same code, same brief) re-ran a known failure.
 *   E4  what must still go through: changed code, changed brief, an explicit override, old runs, measured-only failures.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvaluatorMock } from "@wfact/verification/modelClient";
import { sampleLabelCheck } from "@wfact/verification/checks/claims";
import {
  buildAndVerify,
  resumeBuildAndVerify,
  stuckFingerprint,
  wouldRepeat,
  MemoryArtifactStore,
  type WorkflowDeps,
} from "../src/buildAndVerify.js";

const FIXTURES = path.join(import.meta.dirname, "..", "..", "verification", "test", "fixtures");
const BROKEN = readFileSync(path.join(FIXTURES, "broken.html"), "utf-8");
const CLEAN = readFileSync(path.join(FIXTURES, "clean.html"), "utf-8").replace(
  '<section id="contact">',
  '<section id="services"><p>What we do.</p></section>\n  <section id="process"><p>How it works.</p></section>\n  <section id="contact">',
);

const brief = {
  clientSlug: "dreamsign-pilot",
  entitySlug: "dreamsign",
  projectName: "DreamSign Homepage",
  goal: "A one-page homepage introducing DreamSign's services.",
  requiredSections: ["hero", "services", "process", "contact"],
  brandNotes: "Clean, trustworthy, restrained.",
  templatePreference: "clean-agency",
  source: "placeholder-2.0-case",
};

/** A builder that always answers `page` (counted), an approving QA model (counted), one shared audit trail and store. */
function rig(page: string, shared: { sink: InMemoryAuditSink; store: MemoryArtifactStore }, codeVersion: string | null = "sha-1") {
  const builder = new BuilderMock(() => page);
  const qaModel = new EvaluatorMock(() => "VERDICT: APPROVED");
  const deps: WorkflowDeps = {
    frontEndAgent: createFrontendBuilderAgent({ builderModel: builder, evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: qaModel }),
    registry: createSeedRegistry(),
    audit: shared.sink,
    reader: shared.sink,
    artifacts: shared.store,
    knownClientSlugs: ["dreamsign-pilot", "bennett-co"],
    maxQaRevisions: 2,
    codeVersion,
  };
  return { deps, builder, qaModel };
}
const fresh = () => ({ sink: new InMemoryAuditSink(), store: new MemoryArtifactStore() });
const rows = (sink: InMemoryAuditSink, runId: string, action: string) => sink.events.filter((e) => e.runId === runId && e.action === action);

/** A run that got stuck: the builder keeps answering the same broken page. */
async function stuckRun(codeVersion: string | null = "sha-1") {
  const shared = fresh();
  const first = rig(BROKEN, shared, codeVersion);
  const halted = await buildAndVerify(brief, first.deps);
  return { shared, first, halted };
}

// ---- E1: the claims gate and the builder's rulebook agree on real quotes -----------------------------------------------

const QUOTE = "We came in with a messy process and a rough idea. They helped us turn it into something our whole team uses.";
const page = (cards: string) => `<!doctype html><html><head><title>Home</title></head><body><main>
<section id="social-proof"><h2>What our clients say</h2><div class="grid">${cards}</div></section></main></body></html>`;
const card = (quote: string, who: string) => `<figure class="testimonial"><blockquote>“${quote}”</blockquote><figcaption>${who}</figcaption></figure>`;
const ownerQuotes = [`Real customer quotes: "${QUOTE}" (Dana R., studio manager)\n"Fast, honest and on budget every single time we asked." (Lee K.)`];

test("E1 d3c45995: a testimonial quoting the owner's supplied words passes without a SAMPLE label", () => {
  const html = page(card(QUOTE, "Dana R., studio manager") + card("Fast, honest and on budget every single time we asked.", "Lee K."));
  const r = sampleLabelCheck.run({ html, clientSlug: "x", requiredSections: [], otherClientSlugs: [], factSources: ownerQuotes }) as { passed: boolean; details: string[] };
  assert.equal(r.passed, true, r.details.join("\n"));
});

test("E1: an invented testimonial still needs its SAMPLE label (R-10 unchanged)", () => {
  const html = page(card(QUOTE, "Dana R.") + card("Absolutely the best agency in the whole city, five stars from us.", "Sam P."));
  const r = sampleLabelCheck.run({ html, clientSlug: "x", requiredSections: [], otherClientSlugs: [], factSources: ownerQuotes }) as { passed: boolean; details: string[] };
  assert.equal(r.passed, false);
  assert.equal(r.details.length, 1, "only the invented card is flagged");
  assert.match(r.details[0]!, /best agency/);
});

test("E1: a short supplied phrase cannot excuse an invented testimonial wrapped around it", () => {
  const padded = `They helped us so much. ${"Honestly the most incredible experience of our entire working lives, ".repeat(2)}fast, honest and on budget.`;
  const html = page(card(padded, "Sam P.") + card(QUOTE, "Dana R."));
  const r = sampleLabelCheck.run({ html, clientSlug: "x", requiredSections: [], otherClientSlugs: [], factSources: ownerQuotes }) as { passed: boolean; details: string[] };
  assert.equal(r.passed, false);
});

test("E1: with no fact sources nothing is treated as supplied", () => {
  const html = page(card(QUOTE, "Dana R.") + card(QUOTE, "Dana R."));
  const r = sampleLabelCheck.run({ html, clientSlug: "x", requiredSections: [], otherClientSlugs: [] }) as { passed: boolean };
  assert.equal(r.passed, false);
});

test("E1: one copied brief sentence in a plain-paragraph testimonials section cannot excuse invented quotes beside it", () => {
  const html = `<!doctype html><html><head><title>Home</title></head><body><main><section id="kind-words"><h2>What our clients say</h2>
<div><p>${QUOTE}</p><p>Absolutely the best agency in the whole city, five stars from all of us.</p></div></section></main></body></html>`;
  const r = sampleLabelCheck.run({ html, clientSlug: "x", requiredSections: [], otherClientSlugs: [], factSources: ownerQuotes }) as { passed: boolean };
  assert.equal(r.passed, false);
  const real = html.replace(/<p>Absolutely[^<]*<\/p>/, "<p>Fast, honest and on budget every single time we asked.</p>");
  const ok = sampleLabelCheck.run({ html: real, clientSlug: "x", requiredSections: [], otherClientSlugs: [], factSources: ownerQuotes }) as { passed: boolean; details: string[] };
  assert.equal(ok.passed, true, ok.details.join("\n"));
});

test("E1: a quote must match on whole words, not as the tail of a longer word", () => {
  const html = page(card("They helped us turn it into something our whole team us", "X") + card(QUOTE, "Dana R."));
  const r = sampleLabelCheck.run({ html, clientSlug: "x", requiredSections: [], otherClientSlugs: [], factSources: [`"They helped us turn it into something our whole team useful."`] }) as { passed: boolean };
  assert.equal(r.passed, false);
});

// ---- E2: a revision that changes nothing stops the run instead of paying for the next one ------------------------------

test("E2: the same deterministic failure after a revision halts as STUCK one revision early", async () => {
  const { shared, halted } = await stuckRun();
  assert.equal(halted.status, "failed_verification");
  assert.match(halted.reason ?? "", /^STUCK:/);
  assert.equal(halted.cycles, 2, "first build plus one revision; the second revision (a known failure) is never paid for");
  assert.equal(rows(shared.sink, halted.workflowRunId, "workflow.checkpoint").length, 2);
  const halt = rows(shared.sink, halted.workflowRunId, "workflow.halt").at(-1)!;
  assert.equal(halt.payload?.stuck, true);
  assert.ok((halt.payload?.fingerprint as string[]).length > 0);
  assert.equal(halt.payload?.codeVersion, "sha-1");
  assert.match(String(halt.payload?.briefDigest), /^[0-9a-f]{16}$/);
});

test("E2: a revision that does fix the page is not cut short", async () => {
  const shared = fresh();
  const builder = new BuilderMock((req) => (req.user.includes("Issues to fix") ? CLEAN : BROKEN));
  const { deps } = rig(BROKEN, shared);
  const result = await buildAndVerify(brief, { ...deps, frontEndAgent: createFrontendBuilderAgent({ builderModel: builder, evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }) });
  assert.equal(result.status, "awaiting_launch_approval");
});

test("E2: measured or model-judged failures never count as stuck (a re-measure can pass: job c775c396, LCP 2.52 s)", () => {
  const fp = stuckFingerprint({ failedChecks: [{ checkId: "render.perf", details: ["LCP 2.52 s on mobile"] }, { checkId: "render.design-review", details: ["DR-x"] }], evaluatorIssues: ["anything"] });
  assert.deepEqual(fp, []);
});

test("E2: a revision that shrinks a defect (5 images to 2) is progress, not stuck", () => {
  const a = stuckFingerprint({ failedChecks: [{ checkId: "a11y.alt", details: ["5 images have no alt text"] }], evaluatorIssues: [] });
  const b = stuckFingerprint({ failedChecks: [{ checkId: "a11y.alt", details: ["2 images have no alt text"] }], evaluatorIssues: [] });
  assert.notDeepEqual(a, b);
  const c = stuckFingerprint({ failedChecks: [{ checkId: "a11y.alt", details: ["2 images have no alt text"] }], evaluatorIssues: ["other words"] });
  assert.deepEqual(b, c, "evaluator wording never changes the fingerprint");
});

// ---- E3: a continue with nothing changed is refused before anything is paid ---------------------------------------------

test("E3 e2a204fb: 'Fix and continue' on a stuck run with the same code and brief is refused, nothing spent", async () => {
  const { shared, halted } = await stuckRun();
  const again = rig(CLEAN, shared, "sha-1");
  const r = await resumeBuildAndVerify(halted.workflowRunId, again.deps, { reopen: { reason: "fix and continue", by: "user-1" }, fromStep: "revise" });
  assert.equal(r.status, "repeat_refused");
  assert.match(r.reason ?? "", /nothing was spent/);
  assert.ok(r.qaFailure && r.qaFailure.failedChecks.length > 0, "the stop's findings are handed back so the Cockpit can show them");
  assert.equal(again.builder.calls.length, 0, "no builder call");
  assert.equal(again.qaModel.calls.length, 0, "no reviewer call");
  assert.equal(rows(shared.sink, halted.workflowRunId, "workflow.reopen").length, 0, "the run was not reopened");
  assert.equal(rows(shared.sink, halted.workflowRunId, "workflow.reopen_refused").length, 1, "the refusal is on the record");
});

test("E3: 'Check again without changes' on the same saved site, code and brief is refused even when not stuck", async () => {
  const shared = fresh();
  const first = rig(BROKEN, shared);
  const halted = await buildAndVerify(brief, { ...first.deps, maxQaRevisions: 0 });
  assert.equal(halted.status, "failed_verification");
  const r = await resumeBuildAndVerify(halted.workflowRunId, rig(BROKEN, shared).deps, { reopen: { reason: "check again", by: "user-1" }, fromStep: "qa" });
  assert.equal(r.status, "repeat_refused");
});

test("E3: a continue WITH new details that still changes nothing is caught after one revision, not two", async () => {
  const { shared, halted } = await stuckRun("sha-1");
  const next = rig(BROKEN, shared, "sha-1");
  const withFacts = { ...brief, ownerFacts: [{ key: "phone", label: "Business phone number", value: "(415) 555-0199" }] };
  const r = await resumeBuildAndVerify(halted.workflowRunId, next.deps, { reopen: { reason: "details added", by: "user-1", brief: withFacts }, fromStep: "revise" });
  assert.match(r.reason ?? "", /^STUCK:/);
  const checkpoints = rows(shared.sink, halted.workflowRunId, "workflow.checkpoint").length;
  assert.equal(checkpoints, 3, "the original 2 plus exactly one paid revision on the continue");
});

// ---- E4: everything that has a real chance of a different result still goes through ------------------------------------

test("E4: new factory code (a fix was deployed) continues the stuck run", async () => {
  const { shared, halted } = await stuckRun("sha-1");
  const fixed = rig(CLEAN, shared, "sha-2");
  const r = await resumeBuildAndVerify(halted.workflowRunId, fixed.deps, { reopen: { reason: "fixed", by: "user-1" }, fromStep: "revise" });
  assert.equal(r.status, "awaiting_launch_approval");
  assert.ok(fixed.builder.calls.length >= 1);
});

test("E4: details the owner added (a changed brief) continue the stuck run", async () => {
  const { shared, halted } = await stuckRun("sha-1");
  const next = rig(CLEAN, shared, "sha-1");
  const withFacts = { ...brief, ownerFacts: [{ key: "phone", label: "Business phone number", value: "(415) 555-0199" }] };
  const r = await resumeBuildAndVerify(halted.workflowRunId, next.deps, { reopen: { reason: "details added", by: "user-1", brief: withFacts }, fromStep: "revise" });
  assert.notEqual(r.status, "repeat_refused");
  assert.ok(next.builder.calls.length >= 1);
});

test("E4: an explicit override (force) continues even when nothing changed", async () => {
  const { shared, halted } = await stuckRun("sha-1");
  const next = rig(CLEAN, shared, "sha-1");
  const r = await resumeBuildAndVerify(halted.workflowRunId, next.deps, { reopen: { reason: "override", by: "huraira", force: true }, fromStep: "revise" });
  assert.equal(r.status, "awaiting_launch_approval");
});

test("E4: a runner that does not know its code version never refuses (fail open only where nothing is known)", async () => {
  const { shared, halted } = await stuckRun(null);
  const r = await resumeBuildAndVerify(halted.workflowRunId, rig(CLEAN, shared, null).deps, { reopen: { reason: "x", by: "user-1" }, fromStep: "revise" });
  assert.notEqual(r.status, "repeat_refused");
});

test("E4: halts recorded before this change (no digest) are never refused, and rebuilds are never refused", () => {
  const legacy = { action: "workflow.halt", payload: { status: "failed_verification", stuck: true } } as never;
  assert.equal(wouldRepeat(legacy, { briefDigest: "d", codeVersion: "c", fromStep: "qa" }).repeat, false);
  const modern = { action: "workflow.halt", payload: { status: "failed_verification", stuck: true, fingerprint: ["x|y"], briefDigest: "d", codeVersion: "c" } } as never;
  assert.equal(wouldRepeat(modern, { briefDigest: "d", codeVersion: "c", fromStep: "revise" }).repeat, true);
  assert.equal(wouldRepeat(modern, { briefDigest: "d", codeVersion: "c", fromStep: "rebuild" }).repeat, false);
  const outage = { action: "workflow.halt", payload: { status: "not_verified_no_evaluator", fingerprint: ["x|y"], briefDigest: "d", codeVersion: "c" } } as never;
  assert.equal(wouldRepeat(outage, { briefDigest: "d", codeVersion: "c", fromStep: "qa" }).repeat, false, "a reviewer outage can clear by itself");
});
