/**
 * Step 7 acceptance for the evaluation registry's data and its deterministic text gate:
 *   - the registry is valid versioned data and agrees with the code (no orphan in either direction);
 *   - EVERY entry has a passing and a broken fixture that exist; for text checks, each passing fixture passes
 *     the check and each broken fixture fails it (an "isolated" fixture fails nothing else at its stage);
 *   - severity behaves: a minor failure is advisory (does not fail VerificationLoop), blocker/major gate;
 *   - stage behaves: launch checks are N/A, with their reason, at preview;
 *   - the registry gate is a superset of the Step 4B M1 gate, in registry (fix) order;
 *   - the tells list maps every named tell to a check and states the missing ones as a number, not invented.
 * Rendered fixtures are run in Chromium by packages/rendered-qa/test/registryRendered.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  REGISTRY_PATH, TEXT_CHECK_IMPLS, entriesFor, gateTextChecks, gates, loadRegistry, notRunResults, registry, registryCheck, registryTable, validateRegistry,
  type EvaluationRegistry, type FixtureSpec, type RegistryEntry,
} from "../src/evalRegistry.js";
import { QA_GATE_CHECKS, registryGateChecks, runChecks } from "../src/registry.js";
import { VerificationLoop } from "../src/verificationLoop.js";
import { MockModelClient } from "../src/modelClient.js";
import type { SiteFiles, VerificationContext } from "../src/checks/types.js";

const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const reg = registry();
const brief = JSON.parse(readFileSync(path.join(repo, reg.fixtureContext.brief), "utf-8")) as { clientSlug: string; goal: string; brandNotes: string };

function readSite(dir: string, pages?: string[]): SiteFiles {
  const files: Record<string, string> = {};
  const walk = (rel: string) => {
    for (const name of readdirSync(path.join(dir, rel))) {
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(path.join(dir, r)).isDirectory()) walk(r);
      else files[r] = readFileSync(path.join(dir, r), "utf-8");
    }
  };
  walk("");
  const html = Object.keys(files).filter((f) => f.endsWith(".html") && f !== "404.html" && !f.startsWith("404/")).sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)));
  return { files, pages: pages ?? html };
}

/** The verification context a fixture spec describes (page or site), with the registry's fixture context. */
export function fixtureCtx(spec: FixtureSpec, stage: "preview" | "launch"): VerificationContext {
  const s = typeof spec === "string" ? { path: spec } : spec;
  if ("test" in s) throw new Error("test-held fixture has no file context");
  const abs = path.join(repo, s.path);
  const base: VerificationContext = {
    html: "",
    clientSlug: brief.clientSlug,
    requiredSections: reg.fixtureContext.requiredSections,
    otherClientSlugs: reg.fixtureContext.otherClientSlugs,
    factSources: [brief.goal, brief.brandNotes],
    stage,
    ...(s.ctx ?? {}),
  };
  if (statSync(abs).isDirectory()) {
    const site = readSite(abs, s.pages);
    return { ...base, html: site.files[site.pages[0]!]!, site };
  }
  return { ...base, html: readFileSync(abs, "utf-8") };
}

const fixturePath = (spec: FixtureSpec) => (typeof spec === "string" ? spec : "test" in spec ? spec.test : spec.path);

test("the registry file is valid, versioned and agrees with the code in both directions", () => {
  const loaded = loadRegistry(REGISTRY_PATH);
  assert.match(loaded.version, /^\d+\.\d+\.\d+$/);
  const textIds = entriesFor("text", loaded).map((e) => e.id).sort();
  assert.deepEqual(textIds, [...TEXT_CHECK_IMPLS.keys()].sort());
  // Every rendered result id rendered-qa can emit has an entry (rendered-qa's own test checks the reverse).
  for (const id of ["render.load", "render.console", "render.links", "render.a11y", "render.layout", "render.js-budget", "render.reduced-motion", "render.design-rules", "render.perf", "render.motion-budget", "render.design-review"]) {
    assert.ok(loaded.checks.some((e) => e.id === id), `no registry entry for ${id}`);
  }
  assert.ok(loaded.checks.length >= 45, `expected the expanded registry, got ${loaded.checks.length}`);
});

test("the validator refuses broken registry data (orphans, reasonless entries, model-judged without a model, minor outside text)", () => {
  const clone = (): EvaluationRegistry => JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  const bad: [string, (r: EvaluationRegistry) => void, RegExp][] = [
    ["duplicate id", (r) => r.checks.push({ ...r.checks[0]! }), /listed twice/],
    ["orphan text entry", (r) => r.checks.push({ ...r.checks[0]!, id: "sec.not-implemented" }), /no text check with this id/],
    ["implemented check missing from data", (r) => (r.checks = r.checks.filter((e) => e.id !== "seo.title")), /"seo\.title" is implemented but has no registry entry/],
    ["no proves", (r) => (r.checks[0]!.proves = ""), /proves/],
    ["no source", (r) => (r.checks[0]!.source = ""), /source/],
    ["no broken fixture", (r) => ((r.checks[0]!.fixtures as { fail?: unknown }).fail = undefined), /broken fixture/],
    ["model-judged with no model", (r) => (r.checks.find((e) => e.id === "evaluator")!.model = null), /must name its model slot/],
    ["automated with a model", (r) => (r.checks[0]!.model = { slot: "evaluator", decision: "x", why: "y" }), /uses no model/],
    ["minor outside text", (r) => (r.checks.find((e) => e.id === "render.links")!.severity = "minor"), /only text checks may be minor/],
    ["bad severity", (r) => ((r.checks[0] as { severity: string }).severity = "critical"), /severity must be one of/],
    ["tell mapped to unknown check", (r) => r.tells.named.push({ tell: "x", checks: ["nope"] }), /unknown check "nope"/],
  ];
  for (const [what, mutate, expect] of bad) {
    const r = clone();
    mutate(r);
    assert.throws(() => validateRegistry(r), expect, what);
  }
});

test("every registry entry names a passing and a broken fixture that exist (test-held fixtures name a real test)", () => {
  for (const e of reg.checks) {
    for (const kind of ["pass", "fail"] as const) {
      const spec = e.fixtures[kind];
      const p = path.join(repo, fixturePath(spec));
      assert.ok(existsSync(p), `${e.id} ${kind} fixture ${fixturePath(spec)} does not exist`);
      if (typeof spec === "object" && "test" in spec) {
        assert.ok(readFileSync(p, "utf-8").includes(spec.name), `${e.id} ${kind}: ${spec.test} has no test mentioning "${spec.name}"`);
      }
    }
  }
});

const gateAt = (stage: "preview" | "launch") => gateTextChecks().filter((c) => stage === "launch" || reg.checks.find((e) => e.id === c.id)!.stage === "preview");

for (const entry of entriesFor("text")) {
  test(`${entry.id} (${entry.severity}, ${entry.stage}): passing fixture passes, broken fixture fails${entry.fixtures.isolated ? " and nothing else" : ""}`, () => {
    const check = registryCheck(entry);
    const pass = runChecks(fixtureCtx(entry.fixtures.pass, entry.stage), [check])[0]!;
    assert.equal(pass.passed, true, `${entry.id} failed its passing fixture: ${pass.details.join("; ")}`);
    assert.equal(pass.notApplicable, undefined, `${entry.id} was N/A on its passing fixture (${pass.notApplicable}); a fixture must exercise the check`);

    const failCtx = fixtureCtx(entry.fixtures.fail, entry.stage);
    const results = runChecks(failCtx, gateAt(entry.stage));
    const own = results.find((r) => r.checkId === entry.id)!;
    assert.equal(own.passed, false, `${entry.id} did not catch its broken fixture ${fixturePath(entry.fixtures.fail)}`);
    assert.ok(own.details.length > 0, `${entry.id} failed without saying why`);
    assert.equal(own.severity, entry.severity);
    assert.equal(Boolean(own.advisory), entry.severity === "minor", `${entry.id}: advisory must match severity minor`);
    if (entry.fixtures.isolated) {
      const others = results.filter((r) => !r.passed && r.checkId !== entry.id);
      assert.deepEqual(others.map((r) => r.checkId), [], `${fixturePath(entry.fixtures.fail)} also failed: ${others.flatMap((r) => r.details).join("; ")}`);
    }
  });
}

test("the clean page and the clean site pass the whole registry gate at preview AND at launch", () => {
  for (const spec of ["packages/verification/test/fixtures/registry/clean.html", "packages/verification/test/fixtures/registry/clean-site"]) {
    for (const stage of ["preview", "launch"] as const) {
      const results = runChecks(fixtureCtx(spec, stage), registryGateChecks());
      const failed = results.filter((r) => !r.passed);
      assert.deepEqual(failed.map((r) => r.checkId), [], `${spec} @ ${stage}: ${failed.flatMap((r) => r.details).join("; ")}`);
    }
  }
});

test("stage: a launch check is N/A at preview with its reason, and runs at launch", () => {
  const ctx = fixtureCtx("packages/verification/test/fixtures/registry/fail/tells.canonical.html", "preview");
  const r = runChecks(ctx, registryGateChecks()).find((x) => x.checkId === "tells.canonical")!;
  assert.equal(r.passed, true);
  assert.match(r.notApplicable ?? "", /launch-stage check/);
  const atLaunch = runChecks({ ...ctx, stage: "launch" }, registryGateChecks()).find((x) => x.checkId === "tells.canonical")!;
  assert.equal(atLaunch.passed, false);
  // A site-level launch check on a single file is N/A with its own reason, never a silent pass.
  const single = runChecks({ ...ctx, stage: "launch" }, registryGateChecks()).find((x) => x.checkId === "tells.sitemap")!;
  assert.match(single.notApplicable ?? "", /single-file page/);
});

test("severity: a minor failure is advisory (VerificationLoop does not fail on it); a major one fails the gate", async () => {
  const evaluator = new MockModelClient(() => "VERDICT: APPROVED", "test-evaluator");
  const minorOnly = fixtureCtx("packages/verification/test/fixtures/registry/fail/sec.target-blank.html", "preview");
  const ok = await new VerificationLoop({ checks: registryGateChecks(), evaluatorModel: evaluator }).run(minorOnly, brief.goal);
  assert.equal(ok.status, "approved");
  const warn = ok.checkResults.find((r) => r.checkId === "sec.target-blank")!;
  assert.equal(warn.passed, false);
  assert.equal(warn.advisory, true);
  assert.equal(gates(warn), false);

  const major = fixtureCtx("packages/verification/test/fixtures/registry/fail/seo.single-h1.html", "preview");
  const failed = await new VerificationLoop({ checks: registryGateChecks(), evaluatorModel: evaluator }).run(major, brief.goal);
  assert.equal(failed.status, "failed_checks");
  assert.equal(evaluator.calls.length, 1, "no evaluator call for a page the deterministic gate failed");
  assert.deepEqual(failed.checkResults.filter(gates).map((r) => r.checkId), ["seo.single-h1"]);
});

test("cost per check is recorded: every deterministic check costs $0 with a time, the evaluator is priced or UNPRICED, never guessed", async () => {
  const evaluator = new MockModelClient(() => "VERDICT: APPROVED", "test-evaluator");
  const r = await new VerificationLoop({ checks: registryGateChecks(), evaluatorModel: evaluator }).run(fixtureCtx("packages/verification/test/fixtures/registry/clean.html", "preview"), brief.goal);
  assert.equal(r.status, "approved");
  const det = r.costs!.filter((c) => c.kind === "deterministic");
  assert.deepEqual(det.map((c) => c.id), registryGateChecks().map((c) => c.id));
  assert.ok(det.every((c) => c.usd === 0 && c.ms >= 0));
  const ev = r.costs!.find((c) => c.id === "evaluator")!;
  assert.equal(ev.kind, "model");
  assert.equal(ev.usd, null, "a mock has no price on file: UNPRICED, not $0");
});

test("the registry gate is a superset of the Step 4B M1 gate, in registry order (security and honesty first)", () => {
  const ids = registryGateChecks().map((c) => c.id);
  for (const c of QA_GATE_CHECKS) assert.ok(ids.includes(c.id), `${c.id} missing from the registry gate`);
  assert.equal(ids[0], "secrets-scan");
  assert.ok(ids.indexOf("claims.unsourced-fact") < ids.indexOf("seo.title"), "content honesty is fixed before SEO");
  assert.deepEqual(ids, entriesFor("text").map((e: RegistryEntry) => e.id));
});

test("NOT RUN results for registry checks an entry point cannot run (never a pass)", () => {
  const r = notRunResults(["rendered", "review"], "no browser here");
  assert.ok(r.length >= 11);
  assert.ok(r.every((x) => x.notRun && !x.passed && x.details[0] === "no browser here"));
  const table = registryTable(r);
  assert.equal(table.length, reg.checks.length);
  assert.ok(table.some((l) => l.startsWith("NOT RUN") && l.includes("render.links")));
});

test("tells: every named 2.0 tell maps to a registry check; the unnamed ones are counted as missing, not invented", () => {
  assert.equal(reg.tells.declaredCount, 20);
  assert.equal(reg.tells.named.length + reg.tells.missing, 20);
  assert.equal(reg.tells.named.length, 10);
  for (const t of reg.tells.named) for (const id of t.checks) assert.ok(reg.checks.some((e) => e.id === id));
  assert.ok(reg.notCovered.length >= 8, "the NOT COVERED list is kept, not emptied");
  assert.ok(reg.sourceInventory.missing.some((m) => /78-check/.test(m)));
});

test("Step 4 pilot artifact through the registry gate: what fails, by id (pilot page report)", () => {
  const html = readFileSync(path.join(repo, "packages/verification/test/fixtures/step4-summit-line-960b61ba.html"), "utf-8");
  const ctx: VerificationContext = { html, clientSlug: brief.clientSlug, requiredSections: ["hero", "services", "packages", "process", "faq", "contact"], otherClientSlugs: reg.fixtureContext.otherClientSlugs, factSources: [brief.goal, brief.brandNotes] };
  const results = runChecks(ctx, registryGateChecks());
  const failing = results.filter(gates).map((r) => r.checkId);
  // The Step 4 human review's findings (claims) plus what the expanded registry adds.
  for (const id of ["claims.sample-label", "claims.banned", "claims.unsourced-fact"]) assert.ok(failing.includes(id), `${id} should fail on the Step 4 artifact`);
  assert.ok(failing.includes("sec.mixed-content") === false, "the Step 4 page loads nothing over plain http");
});
