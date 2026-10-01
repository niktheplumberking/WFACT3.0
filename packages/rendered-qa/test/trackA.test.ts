/**
 * Step 4B M3 acceptance, in real headless Chromium: a multi-page Track A site rendered by the committed
 * starter from the SYNTHETIC Summit Line content passes the whole text gate (Phase 5 six + claims gate,
 * on every page), the rendered suite and the Track A speed budget (Lighthouse on every page). Two planted
 * variants of the same site must fail: one with a broken link (a page removed), one over budget (60 KB of
 * script and a multi-megabyte hero image). Fixtures are rendered at test time so they never drift from
 * the starter.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { QA_GATE_CHECKS, runChecks } from "@wfact/verification/registry";
import { loadBrief } from "../../frontend-loop/src/brief.js";
import { validateSiteContent } from "../../frontend-loop/src/trackA/content.js";
import { renderSite } from "../../frontend-loop/src/trackA/render.js";
import { runRenderedQa, createRenderedSuite, type RenderedRun } from "../src/rendered.js";

const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const brief = loadBrief(path.join(repo, "clients/summit-line-roofing/brief.json"));
const content = validateSiteContent(
  JSON.parse(readFileSync(path.join(repo, "packages/frontend-loop/test/fixtures/track-a/summit-line.content.json"), "utf-8")),
  brief,
).content!;
const site = renderSite(content);

function writeSite(files: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "rqa-track-a-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(path.join(dir, name), body);
  return dir;
}
const out = () => mkdtempSync(path.join(tmpdir(), "rqa-track-a-out-"));
const failing = (r: RenderedRun) => r.results.filter((x) => !x.passed).map((x) => x.checkId);
const detailsOf = (r: RenderedRun, id: string) => r.results.find((x) => x.checkId === id)!.details.join("\n");

test("clean Track A site: text gate passes on every page (claims, SAMPLE labels, sources, required sections)", () => {
  const results = runChecks(
    {
      html: site.files["index.html"]!,
      clientSlug: brief.clientSlug,
      requiredSections: brief.requiredSections,
      otherClientSlugs: ["dreamsign-pilot", "northlight-signs"],
      factSources: [brief.goal, brief.brandNotes],
      site: { files: site.files, pages: site.pages },
    },
    QA_GATE_CHECKS,
  );
  const failed = results.filter((r) => !r.passed);
  assert.deepEqual(failed, [], failed.flatMap((r) => r.details).join("\n"));
  assert.equal(results.length, QA_GATE_CHECKS.length);
});

test("clean Track A site: every rendered check and the Track A speed budget pass on all four pages", async () => {
  const r = await runRenderedQa(writeSite(site.files), { outDir: out(), pages: site.pages, lighthouse: true });
  assert.deepEqual(failing(r), [], r.results.flatMap((x) => x.details).join("\n"));
  assert.deepEqual(Object.keys(r.metrics), site.pages);
  for (const [page, m] of Object.entries(r.metrics)) {
    assert.ok(m.lcpMs !== null && m.lcpMs < 2000, `${page}: LCP ${m.lcpMs} ms`);
    assert.ok(m.cls !== null && m.cls < 0.1, `${page}: CLS ${m.cls}`);
    assert.ok(m.jsBytes < 50 * 1024, `${page}: ${m.jsBytes} bytes of JS`);
  }
  assert.equal(r.shots.length, site.pages.length * 3, "full-page screenshots of every page at 1440/768/375");
  const extra = r.shots.filter((s) => s.page !== "index.html");
  assert.ok(extra.every((s) => s.slices.length <= 2), "pages after the first send at most 2 slices per viewport to the reviewer");
});

test("broken-link fixture: the site with one page removed fails render.links on every page that links to it", async () => {
  const files = { ...site.files };
  delete files["faq.html"];
  const r = await runRenderedQa(writeSite(files), { outDir: out(), pages: site.pages.filter((p) => p !== "faq.html"), lighthouse: false });
  assert.deepEqual(failing(r), ["render.links"]);
  const d = detailsOf(r, "render.links");
  for (const page of ["index.html", "services.html", "contact.html"]) assert.match(d, new RegExp(`${page}: link "Questions" \\(faq\\.html\\) returns HTTP 404`));
});

test("over-budget fixture: 60 KB of script and a heavy hero image fail the JS budget and the LCP budget", async () => {
  // A real, large PNG (random pixels do not compress), made with the browser itself: no binary in the repo.
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.setContent('<canvas id="c" width="1400" height="1000"></canvas>');
  await page.evaluate(() => {
    const c = document.getElementById("c") as HTMLCanvasElement;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 1) img.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
    ctx.putImageData(img, 0, 0);
  });
  const png = await page.locator("#c").screenshot({ type: "png" });
  await browser.close();
  assert.ok(png.length > 2_000_000, `hero image is ${png.length} bytes`);

  const heavyScript = `<script>window.__pad=${JSON.stringify("x".repeat(60 * 1024))};</script>`;
  const hero = '<img src="hero.png" width="1400" height="1000" alt="Roof seen from the street (SYNTHETIC over-budget fixture)" style="width:100%;height:auto">';
  const index = site.files["index.html"]!.replace('<main id="main">', `<main id="main">${hero}`).replace("</body>", `${heavyScript}</body>`);
  const r = await runRenderedQa(writeSite({ ...site.files, "index.html": index, "hero.png": png }), {
    outDir: out(),
    pages: ["index.html"],
    lighthouse: true,
  });
  assert.deepEqual(failing(r).sort(), ["render.js-budget", "render.perf"]);
  assert.match(detailsOf(r, "render.js-budget"), /KB of JavaScript; the budget is 50 KB/);
  assert.match(detailsOf(r, "render.perf"), /LCP \d+\.\d\d s on mobile .*the budget is 2\.0 s/);
});

test("the rendered suite serves a whole site from the verification context", async () => {
  const suite = createRenderedSuite({ outDir: out(), lighthouse: false });
  const results = await suite.run({
    html: site.files["index.html"]!,
    clientSlug: brief.clientSlug,
    requiredSections: [],
    otherClientSlugs: [],
    site: { files: site.files, pages: site.pages },
  });
  assert.deepEqual(results.filter((r) => !r.passed), []);
  assert.deepEqual(Object.keys(suite.lastRun!.metrics), site.pages);
  await assert.rejects(
    () => suite.run({ html: "x", clientSlug: "a", requiredSections: [], otherClientSlugs: [], site: { files: { "../evil.html": "x" }, pages: ["../evil.html"] } }),
    /refusing site file name/,
  );
});
