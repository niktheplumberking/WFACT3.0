/**
 * Rendered QA against real headless Chromium (no mocks). Every planted fixture differs from the
 * clean one by exactly one defect (scripts/make-fixtures.ts), so each test shows the defect is
 * caught by the named check and that the clean page passes everything. Lighthouse is exercised once
 * (it is the slow part); the rest run with it off.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runRenderedQa, type RenderedRun } from "../src/rendered.js";
import { loadRulebook } from "../src/rulebook.js";

const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const designDir = path.join(repo, "packages/frontend-loop/design/fixtures");
const renderDir = path.join(import.meta.dirname, "fixtures");

/** Serves the given files from one temp site and runs rendered QA over all of them in one browser. */
async function run(files: Record<string, string>, opts: { lighthouse?: boolean } = {}): Promise<RenderedRun> {
  const site = mkdtempSync(path.join(tmpdir(), "rqa-site-"));
  for (const [name, src] of Object.entries(files)) copyFileSync(src, path.join(site, name));
  return runRenderedQa(site, { outDir: mkdtempSync(path.join(tmpdir(), "rqa-out-")), pages: Object.keys(files), lighthouse: opts.lighthouse ?? false });
}
const failing = (r: RenderedRun) => r.results.filter((x) => !x.passed).map((x) => x.checkId);
const detailsOf = (r: RenderedRun, id: string) => r.results.find((x) => x.checkId === id)!.details.join("\n");

test("clean fixture passes every rendered check, including Lighthouse against the Track A budget", async () => {
  const r = await run({ "index.html": path.join(designDir, "clean.html") }, { lighthouse: true });
  assert.deepEqual(failing(r), [], r.results.flatMap((x) => x.details).join("\n"));
  assert.equal(r.results.length, 9);
  const m = r.metrics["index.html"]!;
  assert.ok(m.lcpMs !== null && m.lcpMs < 2000, `LCP ${m.lcpMs}`);
  assert.ok(m.jsBytes < 50 * 1024);
  assert.equal(r.shots.length, 3, "one full-page screenshot per viewport");
  assert.deepEqual(r.shots.map((s) => s.width), [1440, 768, 375]);
  assert.ok(r.shots.every((s) => s.slices.length > 0 && readFileSync(s.file).length > 1000));
});

const RENDER_CASES: [fixture: string, checkId: string, expect: RegExp][] = [
  ["broken-link", "render.links", /areas\.html/],
  ["console-error", "render.console", /undefinedFunctionCall/],
  ["over-budget-js", "render.js-budget", /KB of JavaScript; the budget is 50 KB/],
  ["reduced-motion-ignored", "render.reduced-motion", /still run with prefers-reduced-motion/],
];
for (const [fixture, checkId, expect] of RENDER_CASES) {
  test(`planted "${fixture}" fails ${checkId} and nothing else`, async () => {
    const r = await run({ "index.html": path.join(renderDir, `${fixture}.html`) });
    assert.deepEqual(failing(r), [checkId], r.results.flatMap((x) => x.details).join("\n"));
    assert.match(detailsOf(r, checkId), expect);
  });
}

test("broken-link fixture names both the missing page and the missing anchor", async () => {
  const r = await run({ "index.html": path.join(renderDir, "broken-link.html") });
  const d = detailsOf(r, "render.links");
  assert.match(d, /areas\.html/);
  assert.match(d, /#missing-anchor/);
});

test("every DOM-detectable rulebook rule is caught by its own fixture (render.design-rules)", async () => {
  const rules = loadRulebook().rules.filter((x) => x.detect.dom);
  assert.ok(rules.length >= 10);
  const files = Object.fromEntries(rules.map((x) => [`${x.id}.html`, path.join(designDir, x.fixture.replace(/^fixtures\//, ""))]));
  const r = await run(files);
  const d = detailsOf(r, "render.design-rules");
  for (const rule of rules) {
    assert.match(d, new RegExp(`^${rule.id}\\.html: ${rule.id}: `, "m"), `${rule.id} not caught by its fixture`);
  }
  // A fixture planted with one defect must not trip unrelated design rules.
  for (const line of d.split("\n")) {
    const [, page, id] = line.match(/^(D[RQ]-[A-Z-]+)\.html: (D[RQ]-[A-Z-]+):/) ?? [];
    assert.equal(page, id, `fixture ${page} also tripped ${id}: ${line}`);
  }
});

test("Step 4 artifact fails the rendered checks on what the human review saw", async () => {
  const r = await run({ "index.html": path.join(repo, "packages/verification/test/fixtures/step4-summit-line-960b61ba.html") });
  const design = detailsOf(r, "render.design-rules");
  assert.match(design, /DR-FAKE-SOCIAL-PROOF: \d+ initials avatars \(JK, RM, TP/);
  assert.match(design, /DR-EYEBROW-OVERUSE/);
  assert.match(design, /DR-EMOJI-ICONS: emoji or glyph used as an icon: "★"/);
  assert.match(detailsOf(r, "render.layout"), /375px: \d+ tap target\(s\) below 24px/);
});
