/**
 * Build-quality Package 3 (2026-10-14), in real headless Chromium. The SYNTHETIC Lanternworks site is built from the Track B
 * starter with ONE owner-supplied photo (the home hero) and labelled placeholder cards everywhere else (each work item, a
 * team section with no invented people), then:
 *   - every page passes every rendered check (axe, layout, budgets, the Package 2 brand checks), placeholders included;
 *   - the hero shows the supplied image, sized and content-addressed, eager on the home page;
 *   - each work item shows an "Image to come: <note>" card marked data-placeholder, never an external placeholder service;
 *   - the placeholders are exactly what the launch gate lists as still needed, and the launch check refuses them until the
 *     owner ticks "launch with placeholders".
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseBrief } from "../../frontend-loop/src/brief.js";
import { validateSiteContent, type SiteContent } from "../../frontend-loop/src/trackB/content.js";
import { buildTrackBSite, type TrackBBuild } from "../../frontend-loop/src/trackB/build.js";
import { trackBBrand } from "../../frontend-loop/src/trackB/brand.js";
import { inspectImage, loadImageAsset, placeholdersFor } from "../../frontend-loop/src/media.js";
import { lanternworksFixed, LANTERNWORKS_REQUEST } from "../../frontend-loop/test/lanternworksFixed.js";
import { placeholderMediaCheck, placeholdersLaunchCheck } from "../../verification/src/checks/registryChecks.js";
import { runRenderedQa, TRACK_B_BUDGET } from "../src/rendered.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const JPG = readFileSync(path.join(ROOT, "packages/frontend-loop/test/fixtures/lanternworks/hero-sample.jpg"));
const inspected = inspectImage(JPG, "image/jpeg");
const record = { ...inspected, path: `uploads/0b7c3f7e-1d2a-4c55-9e8f-2a1b3c4d5e6f/${inspected.sha256}.jpg` };
const brief = parseBrief({
  clientSlug: "lanternworks-studio", entitySlug: "bennett-co", projectName: "Lanternworks Studio Website", goal: "x",
  brandNotes: "signal orange #F26B38 reserved for interactive elements", requiredSections: [], pageScope: "multi", source: "intake-planner",
  requestText: LANTERNWORKS_REQUEST, images: [{ slot: "index.hero", image: record }],
});

/** The Lanternworks content plus a team section on the about page: no names (the request gives none), a group photo slot. */
function content(): SiteContent {
  const c = lanternworksFixed();
  const hero = c.pages[0]!.sections[0]!;
  if (hero.type === "hero") hero.media = { kind: "supplied", alt: "The Lanternworks studio desk", aspect: "16:9", note: "A photo of the studio" };
  const about = c.pages.find((p) => p.slug === "about")!;
  about.sections.splice(about.sections.length - 1, 0, {
    type: "team", id: "team", heading: "Three of us", intro: "Lanternworks Studio is three people who make brands and websites for small service businesses.",
    members: [], media: { kind: "placeholder", alt: "The three of us at the studio", aspect: "3:2", note: "Team photo, the three of us at the studio" },
  });
  return c;
}

let site: TrackBBuild;
let valid: SiteContent;
before(async () => {
  const v = validateSiteContent(content(), brief);
  assert.deepEqual(v.errors, [], "the media content is valid");
  valid = v.content!;
  const images = new Map([["index.hero", loadImageAsset(record, JPG)]]);
  site = await buildTrackBSite(valid, { accentActionsOnly: true, images });
}, { timeout: 300_000 });

function writeSite(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "rqa-media-"));
  const bin = new Set(site.binary);
  for (const [name, body] of Object.entries(site.files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), bin.has(name) ? Buffer.from(body, "base64") : body);
  }
  return dir;
}

test("the supplied hero photo ships content-addressed and sized; work items and the team show labelled placeholder cards", () => {
  const home = site.files["index.html"]!;
  const file = `media/${record.sha256.slice(0, 16)}.jpg`;
  assert.ok(site.binary.includes(file), "the photo is in the export");
  assert.match(home, new RegExp(`<img src="/${file}" alt="The Lanternworks studio desk" width="1200" height="750" loading="eager"`));
  const work = site.files["work/index.html"]!;
  assert.match(work, /data-placeholder="work\.work\.1"/);
  assert.match(work, /Image to come<\/span><span class="media-note">Project image for/);
  assert.match(site.files["about/index.html"]!, /data-placeholder="about\.team"[\s\S]*Team photo, the three of us at the studio/);
  assert.doesNotMatch(home, /data-placeholder="index\.hero"/, "the supplied slot is not a placeholder");
  // Never an external placeholder service (the registry's content.placeholder-media check, on every page).
  for (const p of site.pages) assert.equal(placeholderMediaCheck.run({ html: site.files[p]!, clientSlug: "lanternworks-studio", requiredSections: [], otherClientSlugs: [] }).passed, true, p);
});

test("the launch gate lists exactly the placeholder slots, and the launch check refuses them until the owner ticks 'launch with placeholders'", () => {
  const listed = placeholdersFor(JSON.stringify(valid), brief).map((p) => p.slot);
  const onPages = site.pages.flatMap((p) => [...site.files[p]!.matchAll(/data-placeholder="([^"]+)"/g)].map((m) => m[1]!));
  assert.deepEqual([...listed].sort(), [...new Set(onPages)].sort());
  assert.ok(!listed.includes("index.hero"));
  const ctx = { html: site.files["index.html"]!, clientSlug: "x", requiredSections: [], otherClientSlugs: [], site: { files: site.files, pages: site.pages } };
  assert.equal(placeholdersLaunchCheck.run(ctx).passed, false);
  assert.equal(placeholdersLaunchCheck.run({ ...ctx, launchWithPlaceholders: true }).passed, true);
});

test("every page with photos and placeholder cards passes every rendered check, the brand checks included", { timeout: 600_000 }, async () => {
  const r = await runRenderedQa(writeSite(), { outDir: mkdtempSync(path.join(tmpdir(), "rqa-media-out-")), pages: site.pages, budget: TRACK_B_BUDGET, lighthouse: false, brand: trackBBrand(valid, brief, false) });
  const failed = r.results.filter((x) => !x.passed);
  assert.deepEqual(failed.map((x) => x.checkId), [], failed.flatMap((x) => x.details).join("\n"));
});
