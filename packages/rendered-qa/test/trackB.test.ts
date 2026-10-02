/**
 * Step 4B M4 acceptance, in real headless Chromium. The SYNTHETIC Northfold site is built from the
 * committed Track B starter by the real isolated build (no network, no secrets, `npm ci --offline`), then:
 *   - the clean site passes the whole text gate on every page, every rendered check, the Track B budget
 *     (Lighthouse LCP/CLS, JS) and the motion budget, and respects reduced motion;
 *   - planted variants of the same build each fail the check they target, and nothing else:
 *       broken link (a page removed)                     -> render.links
 *       over-budget JS (a heavy script added)            -> render.js-budget
 *       over-budget animation (layout animated on scroll,
 *         main thread blocked every frame)               -> render.motion-budget
 *       reduced motion ignored (script keeps animating)  -> render.reduced-motion
 *       reduced motion ignored (script smooths scroll)   -> render.reduced-motion
 * The planted scripts are labelled fixtures written here, not starter code.
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { QA_GATE_CHECKS, runChecks } from "@wfact/verification/registry";
import { loadBrief } from "../../frontend-loop/src/brief.js";
import { validateSiteContent } from "../../frontend-loop/src/trackB/content.js";
import { buildTrackBSite, type TrackBBuild } from "../../frontend-loop/src/trackB/build.js";
import { createRenderedSuite, runRenderedQa, TRACK_B_BUDGET, type RenderedRun } from "../src/rendered.js";

const FX = path.resolve(import.meta.dirname, "..", "..", "frontend-loop", "test", "fixtures", "track-b");
const brief = loadBrief(path.join(FX, "northfold.brief.json"));
const content = validateSiteContent(JSON.parse(readFileSync(path.join(FX, "northfold.content.json"), "utf-8")), brief).content!;
let site: TrackBBuild;

before(async () => {
  site = await buildTrackBSite(content);
}, { timeout: 300_000 });

function writeSite(files: Record<string, string>, binary: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), "rqa-track-b-"));
  const bin = new Set(binary);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), bin.has(name) ? Buffer.from(body, "base64") : body);
  }
  return dir;
}
const out = () => mkdtempSync(path.join(tmpdir(), "rqa-track-b-out-"));
const failing = (r: RenderedRun) => r.results.filter((x) => !x.passed).map((x) => x.checkId);
const detailsOf = (r: RenderedRun, id: string) => r.results.find((x) => x.checkId === id)!.details.join("\n");
const allDetails = (r: RenderedRun) => r.results.flatMap((x) => x.details).join("\n");

/** The home page with a planted inline script before </body>. */
const planted = (script: string) => ({ ...site.files, "index.html": site.files["index.html"]!.replace("</body>", `<script>/* SYNTHETIC planted fixture */${script}</script></body>`) });
const runHome = (files: Record<string, string>) => runRenderedQa(writeSite(files, site.binary), { outDir: out(), pages: ["index.html"], budget: TRACK_B_BUDGET, lighthouse: false });

test("clean Track B site: the text gate passes on every page (claims, SAMPLE labels, sources, required sections)", () => {
  const results = runChecks(
    {
      html: site.files["index.html"]!,
      clientSlug: brief.clientSlug,
      requiredSections: brief.requiredSections,
      otherClientSlugs: ["dreamsign-pilot", "northlight-signs", "summit-line-roofing"],
      factSources: [brief.goal, brief.brandNotes],
      site: { files: site.files, pages: site.pages, binary: site.binary },
    },
    QA_GATE_CHECKS,
  );
  const failed = results.filter((r) => !r.passed);
  assert.deepEqual(failed, [], failed.flatMap((r) => r.details).join("\n"));
});

test("clean Track B site: every rendered check, the Track B budget and the motion budget pass on all three pages", { timeout: 600_000 }, async () => {
  const r = await runRenderedQa(writeSite(site.files, site.binary), { outDir: out(), pages: site.pages, budget: TRACK_B_BUDGET, lighthouse: true });
  assert.deepEqual(failing(r), [], allDetails(r));
  assert.ok(r.results.some((x) => x.checkId === "render.motion-budget" && x.passed), "the motion budget ran and passed");
  for (const [page, m] of Object.entries(r.metrics)) {
    assert.ok(m.lcpMs !== null && m.lcpMs < 2500, `${page}: LCP ${m.lcpMs} ms`);
    assert.ok(m.cls !== null && m.cls < 0.1, `${page}: CLS ${m.cls}`);
    assert.ok(m.jsBytes < 700 * 1024, `${page}: ${m.jsBytes} bytes of JS`);
    assert.ok(m.motion && m.motion.blockingMs !== null && m.motion.blockingMs <= 250, `${page}: scroll blocking ${m.motion?.blockingMs} ms`);
  }
  assert.ok(r.metrics["index.html"]!.motion!.animations > 0, "the home page really animates (motion claimed, motion shown)");
  assert.equal(r.shots.length, site.pages.length * 3);
});

test("broken-link fixture: the site with the services page removed fails render.links on every page that links to it", { timeout: 300_000 }, async () => {
  const files = { ...site.files };
  delete files["services/index.html"];
  const pages = site.pages.filter((p) => p !== "services/index.html");
  const r = await runRenderedQa(writeSite(files, site.binary), { outDir: out(), pages, budget: TRACK_B_BUDGET, lighthouse: false });
  // Next.js prefetches linked pages, so the browser also logs the same missing page as a 404 in the
  // console: the one extra failure allowed, and it must be only that.
  assert.deepEqual(failing(r).filter((id) => id !== "render.console"), ["render.links"], allDetails(r));
  for (const line of r.results.find((x) => x.checkId === "render.console")!.details) assert.match(line, /status of 404/);
  for (const page of pages) assert.match(detailsOf(r, "render.links"), new RegExp(`${page.replace(/[./]/g, "\\$&")}: link "Services" \\(/services/\\) returns HTTP 404`));
});

test("over-budget JS fixture: 200 KB more script fails render.js-budget only", { timeout: 300_000 }, async () => {
  const r = await runHome(planted(`window.__pad=${JSON.stringify("x".repeat(200 * 1024))};`));
  assert.deepEqual(failing(r), ["render.js-budget"], allDetails(r));
  assert.match(detailsOf(r, "render.js-budget"), /KB of JavaScript; the budget is 700 KB/);
});

test("over-budget animation fixture: layout animated on scroll with a blocked main thread fails render.motion-budget only", { timeout: 300_000 }, async () => {
  // Respects reduced motion (so only the budget is at fault): animates width and left on 60 bars on every
  // scroll frame, reading layout after each write, and burns 60 ms of main thread per frame.
  // Starts after load, once React has hydrated (touching <main> earlier is a hydration error, not a motion fault).
  const script = `addEventListener("load", function () { setTimeout(function () {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var host = document.createElement("div"); host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:relative;height:40px;overflow:hidden";
    for (var i = 0; i < 60; i++) { var b = document.createElement("div"); b.className = "planted-bar"; b.style.cssText = "position:absolute;top:0;left:0;width:10px;height:4px;background:currentColor"; host.appendChild(b); }
    document.querySelector("main").appendChild(host);
    var bars = Array.prototype.slice.call(host.children);
    function frame() {
      var y = scrollY;
      bars.forEach(function (b, i) { b.style.width = (10 + ((y + i * 7) % 300)) + "px"; b.style.left = ((y * 0.3 + i * 5) % 200) + "px"; void b.offsetWidth; });
      var t = performance.now(); while (performance.now() - t < 60) {}
    }
    addEventListener("scroll", function () { requestAnimationFrame(frame); }, { passive: true });
  }, 300); });`;
  const r = await runHome(planted(script));
  assert.deepEqual(failing(r), ["render.motion-budget"], allDetails(r));
  const d = detailsOf(r, "render.motion-budget");
  assert.match(d, /animate layout while scrolling: div\.planted-bar (width|left) took \d+ values/);
  assert.match(d, /scrolling the page blocked the main thread for \d+ ms .*the budget is 250 ms/);
});

test("reduced-motion fixture: a script that keeps animating with reduced motion requested fails render.reduced-motion only", { timeout: 300_000 }, async () => {
  const script = `(function () {
    var h = document.querySelector("h1"), t0 = performance.now();
    function f(t) { h.style.transform = "translateY(" + (Math.sin(((t - t0) / 1000) * Math.PI) * 12).toFixed(2) + "px)"; requestAnimationFrame(f); }
    requestAnimationFrame(f);
  })();`;
  const r = await runHome(planted(script));
  assert.deepEqual(failing(r), ["render.reduced-motion"], allDetails(r));
  assert.match(detailsOf(r, "render.reduced-motion"), /still animated by script with prefers-reduced-motion: reduce: h1\.display\.hero-heading transform took \d+ values/);
});

test("reduced-motion fixture: smooth scrolling forced on with reduced motion requested fails render.reduced-motion only", { timeout: 300_000 }, async () => {
  const script = `(function () {
    var target = 0, current = 0, running = false;
    function step() { current += (target - current) * 0.12; scrollTo(0, current); if (Math.abs(target - current) > 0.5) requestAnimationFrame(step); else running = false; }
    addEventListener("wheel", function (e) {
      e.preventDefault();
      if (!running) current = scrollY;
      target = Math.max(0, Math.min(target + e.deltaY, document.documentElement.scrollHeight - innerHeight));
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: false });
  })();`;
  const r = await runHome(planted(script));
  assert.deepEqual(failing(r), ["render.reduced-motion"], allDetails(r));
  assert.match(detailsOf(r, "render.reduced-motion"), /scrolling is smoothed by script with prefers-reduced-motion: reduce \(one wheel step passed through \d+ positions\)/);
});

test("the rendered suite serves a Track B site from the verification context (nested files, base64 fonts)", { timeout: 300_000 }, async () => {
  const suite = createRenderedSuite({ outDir: out(), lighthouse: false, budget: TRACK_B_BUDGET });
  const results = await suite.run({
    html: site.files["index.html"]!,
    clientSlug: brief.clientSlug,
    requiredSections: [],
    otherClientSlugs: [],
    site: { files: site.files, pages: site.pages, binary: site.binary },
  });
  assert.deepEqual(results.filter((r) => !r.passed), []);
  await assert.rejects(
    () => suite.run({ html: "x", clientSlug: "a", requiredSections: [], otherClientSlugs: [], site: { files: { "a/../../evil.html": "x" }, pages: ["a/../../evil.html"] } }),
    /refusing site file name/,
  );
});
