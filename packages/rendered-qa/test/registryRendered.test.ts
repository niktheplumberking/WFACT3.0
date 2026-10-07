/**
 * Step 7: the evaluation registry's rendered checks, run for real in headless Chromium from the registry DATA
 * (packages/verification/config/eval-registry.json): every rendered entry's broken fixture fails that check
 * (an "isolated" one fails no other rendered check), its passing fixture passes, and the registry and
 * rendered.ts agree on which rendered checks exist. Also: production QA runs the registry gate and refuses a
 * same-family builder/evaluator pair before anything is built.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { entriesFor, type FixtureSpec } from "@wfact/verification/evalRegistry";
import { registryGateChecks } from "@wfact/verification/registry";
import { CrossModelViolationError } from "@wfact/verification/crossModel";
import { ClaudeModelClient } from "@wfact/verification/modelClient";
import { runRenderedQa } from "../src/rendered.js";
import { productionQaOptions } from "../src/production.js";

const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const out = () => mkdtempSync(path.join(tmpdir(), "rqa-registry-out-"));
const fileSpec = (spec: FixtureSpec) => (typeof spec === "string" ? { path: spec } : "test" in spec ? null : spec);

test("registry and rendered.ts agree: every rendered result id has an entry and every rendered entry is a real result id", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rqa-registry-ids-"));
  copyFileSync(path.join(repo, "packages/frontend-loop/design/fixtures/clean.html"), path.join(dir, "index.html"));
  const r = await runRenderedQa(dir, { outDir: out(), lighthouse: false });
  const emitted = new Set([...r.results.map((x) => x.checkId), "render.perf", "render.motion-budget"]);
  const registered = new Set(entriesFor("rendered").map((e) => e.id));
  assert.deepEqual([...registered].sort(), [...emitted].sort());
  assert.ok(entriesFor("review").some((e) => e.id === "render.design-review"));
});

test("every rendered registry entry with a file fixture: broken fixture fails its check (isolated ones nothing else); passing fixture passes", async () => {
  const entries = entriesFor("rendered").filter((e) => fileSpec(e.fixtures.fail) && !fileSpec(e.fixtures.fail)!.pages);
  assert.ok(entries.length >= 7, `expected the rendered file fixtures, got ${entries.length}`);
  // One site, one browser: each entry's broken fixture is a page named after the entry; plus the passing fixture.
  const dir = mkdtempSync(path.join(tmpdir(), "rqa-registry-site-"));
  const pages: string[] = [];
  for (const e of entries) {
    copyFileSync(path.join(repo, fileSpec(e.fixtures.fail)!.path), path.join(dir, `${e.id}.html`));
    pages.push(`${e.id}.html`);
  }
  copyFileSync(path.join(repo, "packages/frontend-loop/design/fixtures/clean.html"), path.join(dir, "pass.html"));
  pages.push("pass.html");
  const r = await runRenderedQa(dir, { outDir: out(), pages, lighthouse: false });
  const failuresOn = (page: string) =>
    r.results.filter((x) => x.details.some((d) => d.startsWith(`${page}: `))).map((x) => x.checkId);
  assert.deepEqual(failuresOn("pass.html"), [], "the passing fixture failed a rendered check");
  for (const e of entries) {
    const failed = failuresOn(`${e.id}.html`);
    assert.ok(failed.includes(e.id), `${e.id} did not catch its broken fixture ${fileSpec(e.fixtures.fail)!.path} (failed: ${failed.join(", ") || "nothing"})`);
    if (e.fixtures.isolated) assert.deepEqual(failed, [e.id], `${e.id}: isolated fixture also failed ${failed.filter((x) => x !== e.id).join(", ")}`);
  }
});

test("render.load: a page that is not in the build fails to load", async () => {
  const e = entriesFor("rendered").find((x) => x.id === "render.load")!;
  const spec = fileSpec(e.fixtures.fail)!;
  const dir = mkdtempSync(path.join(tmpdir(), "rqa-registry-load-"));
  copyFileSync(path.join(repo, spec.path), path.join(dir, "index.html"));
  const r = await runRenderedQa(dir, { outDir: out(), pages: spec.pages, lighthouse: false });
  const load = r.results.find((x) => x.checkId === "render.load")!;
  assert.equal(load.passed, false);
  assert.match(load.details.join("\n"), /gone\.html: .*HTTP 404/);
  assert.ok(!load.details.some((d) => d.startsWith("index.html")));
});

test("production QA runs the registry gate and refuses a same-family builder/evaluator pair before anything is built", () => {
  const claudeEvaluator = new ClaudeModelClient("sk-ant-test-not-real", "claude-sonnet-5");
  const ok = productionQaOptions({ evaluatorModel: claudeEvaluator, builderVendor: "agent37", builderModel: { name: "agent37" }, env: {} });
  assert.deepEqual(ok.checks!.map((c) => c.id), registryGateChecks().map((c) => c.id));
  // Agent 37 not configured -> the builder falls back to Claude; a Claude evaluator must then be refused.
  assert.throws(
    () => productionQaOptions({ evaluatorModel: claudeEvaluator, builderVendor: "claude", builderModel: new ClaudeModelClient("sk-ant-test-not-real", "claude-sonnet-5"), env: {} }),
    CrossModelViolationError,
  );
  assert.throws(() => productionQaOptions({ evaluatorModel: claudeEvaluator, builderVendor: "claude", env: {} }), CrossModelViolationError);
  // No evaluator configured: allowed at composition (the run ends "not verified", never approved).
  assert.doesNotThrow(() => productionQaOptions({ evaluatorModel: null, builderVendor: "claude", env: {} }));
});
