/**
 * MVP M5 (`docs/MVP-CUTLINE.md`): both starters' launch files, judged by the real Step 7 launch-stage checks rather
 * than by the code that wrote them. With the owner's production address every launch check passes; without it the
 * ones that need an absolute URL fail and say what is missing. Track B runs on a real isolated build.
 *
 * It lives here, not in frontend-loop or verification, because it needs both packages: this is the only CI job
 * that installs both (each package's own job installs only its own dependencies).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runChecks } from "@wfact/verification/registry";
import { gateTextChecks, registry } from "@wfact/verification/evalRegistry";
import type { VerificationContext } from "@wfact/verification/checks/types";
import { loadBrief } from "../../frontend-loop/src/brief.js";
import { validateSiteContent } from "../../frontend-loop/src/trackA/content.js";
import { renderSite } from "../../frontend-loop/src/trackA/render.js";
import { validateSiteContent as validateTrackB } from "../../frontend-loop/src/trackB/content.js";
import { buildTrackBSite, type TrackBBuild } from "../../frontend-loop/src/trackB/build.js";
import { normalizeSiteUrl } from "../../frontend-loop/src/launch.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const brief = loadBrief(path.join(ROOT, "clients", "summit-line-roofing", "brief.json"));
const fixture = JSON.parse(readFileSync(path.join(ROOT, "packages", "frontend-loop", "test", "fixtures", "track-a", "summit-line.content.json"), "utf-8"));
const content = validateSiteContent(fixture, brief).content!;
const LAUNCH_IDS = registry().checks.filter((e) => e.stage === "launch").map((e) => e.id);

function launchResults(siteUrl: string | null) {
  const site = renderSite(content, { siteUrl });
  const ctx: VerificationContext = {
    html: site.files["index.html"]!,
    clientSlug: brief.clientSlug,
    requiredSections: [],
    otherClientSlugs: [],
    site: { files: site.files, pages: site.pages, binary: site.binary },
    stage: "launch",
  };
  return { site, results: runChecks(ctx, gateTextChecks().filter((c) => LAUNCH_IDS.includes(c.id))) };
}

test("Track A with the production address: every launch-stage check passes", () => {
  assert.deepEqual([...LAUNCH_IDS].sort(), ["tells.404-page", "tells.canonical", "tells.llms-txt", "tells.og-image", "tells.robots", "tells.sitemap"]);
  const { site, results } = launchResults("https://summitline.co");
  assert.equal(results.length, LAUNCH_IDS.length);
  for (const r of results) assert.ok(r.passed && !r.notApplicable, `${r.checkId}: ${r.details.join(" | ")}`);
  assert.match(site.files["index.html"]!, /<link rel="canonical" href="https:\/\/summitline\.co\/">/);
  assert.match(site.files["services.html"]!, /<link rel="canonical" href="https:\/\/summitline\.co\/services\.html">/);
  assert.match(site.files["robots.txt"]!, /^Sitemap: https:\/\/summitline\.co\/sitemap\.xml$/m);
  assert.ok(Buffer.from(site.files["og-image.png"]!, "base64").subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "a real PNG");
  assert.match(site.files["404.html"]!, /href="\/services\.html"/, "404 links work from any depth");
  assert.match(site.files["404.html"]!, /<meta name="robots" content="noindex">/);
});

test("Track A without the production address: no guessed domain; the URL checks fail and name what is missing", () => {
  const { site, results } = launchResults(null);
  const failed = results.filter((r) => !r.passed).map((r) => r.checkId).sort();
  assert.deepEqual(failed, ["tells.canonical", "tells.og-image", "tells.sitemap"]);
  assert.equal(site.files["sitemap.xml"], undefined);
  assert.doesNotMatch(site.files["robots.txt"]!, /Sitemap:/);
  for (const page of site.pages) assert.doesNotMatch(site.files[page]!, /rel="canonical"|og:url|og:image/, `${page}: no URL tags without an address`);
});

test("only a real https production origin is accepted as the site address", () => {
  assert.equal(normalizeSiteUrl("https://BennettAndCo.com/"), "https://bennettandco.com");
  for (const bad of ["http://bennettandco.com", "https://bennettandco.com/home", "https://wfact-preview.vercel.app", "https://localhost", "https://example.com", "https://10.0.0.1", "bennettandco.com", ""]) {
    assert.equal(normalizeSiteUrl(bad), null, bad);
  }
});

test("Track B on a real isolated build: with the address every launch-stage check passes; without it nothing is guessed", { timeout: 600_000 }, async () => {
  const FX = path.join(ROOT, "packages", "frontend-loop", "test", "fixtures", "track-b");
  const nfBrief = loadBrief(path.join(FX, "northfold.brief.json"));
  const nf = validateTrackB(JSON.parse(readFileSync(path.join(FX, "northfold.content.json"), "utf-8")), nfBrief).content!;
  const launchCheck = (b: TrackBBuild) =>
    runChecks(
      { html: b.files["index.html"]!, clientSlug: nfBrief.clientSlug, requiredSections: [], otherClientSlugs: [], site: { files: b.files, pages: b.pages, binary: b.binary }, stage: "launch" },
      gateTextChecks().filter((c) => LAUNCH_IDS.includes(c.id)),
    );
  const live = await buildTrackBSite(nf, { siteUrl: "https://northfold.studio" });
  for (const r of launchCheck(live)) assert.ok(r.passed && !r.notApplicable, `${r.checkId}: ${r.details.join(" | ")}`);
  assert.match(live.files["services/index.html"]!, /<link rel="canonical" href="https:\/\/northfold\.studio\/services\/"/);
  assert.match(live.files["index.html"]!, /<meta property="og:image" content="https:\/\/northfold\.studio\/og-image\.png"/);
  assert.match(live.files["robots.txt"]!, /^Sitemap: https:\/\/northfold\.studio\/sitemap\.xml$/m);
  assert.deepEqual(JSON.parse(live.source["content/launch.json"]!), { siteUrl: "https://northfold.studio" });

  const failed = launchCheck(await buildTrackBSite(nf)).filter((r) => !r.passed).map((r) => r.checkId).sort();
  assert.deepEqual(failed, ["tells.canonical", "tells.og-image", "tells.sitemap"], "no address: the URL checks fail and say so");
});
