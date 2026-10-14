/**
 * Build-quality Package 2 (2026-10-14), in real headless Chromium. The SYNTHETIC Lanternworks site (the stored content of
 * job 55ddba7c with the Package 1 gaps closed, the client's SVG logo, "signal orange for buttons and links only") is built
 * from the committed Track B starter, then:
 *   - the clean site passes every rendered check, including the four Package 2 checks:
 *       render.logo-visible, render.mobile-action-visible, render.accent-usage, render.motion-coverage;
 *   - planted variants of the same build each fail the check they target, and no other Package 2 check:
 *       logo squashed to 4 px                        -> render.logo-visible
 *       every primary-action control hidden on phones -> render.mobile-action-visible
 *       a section filled with the accent              -> render.accent-usage
 *       every animation and transition removed        -> render.motion-coverage
 * The planted CSS is a labelled fixture written here, not starter code.
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseBrief } from "../../frontend-loop/src/brief.js";
import { validateSiteContent } from "../../frontend-loop/src/trackB/content.js";
import { buildTrackBSite, STARTER_VERSION, type TrackBBuild } from "../../frontend-loop/src/trackB/build.js";
import { trackBBrand } from "../../frontend-loop/src/trackB/brand.js";
import { inspectLogo, loadLogoAsset } from "../../frontend-loop/src/brandAsset.js";
import { verifyRequested } from "../../frontend-loop/src/request.js";
import { lanternworksFixed, LANTERNWORKS_REQUEST } from "../../frontend-loop/test/lanternworksFixed.js";
import { runRenderedQa, TRACK_B_BUDGET, type BrandExpectations, type RenderedRun } from "../src/rendered.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const FX = path.join(ROOT, "packages", "frontend-loop", "test", "fixtures", "lanternworks");
const brief = parseBrief({
  clientSlug: "lanternworks-studio",
  entitySlug: "bennett-co",
  projectName: "Lanternworks Studio Website",
  goal: "A studio site that sells what Lanternworks does.",
  brandNotes: "Use only the three fixed brand colors, navy #14213D, paper white #FAF7F2, and signal orange #F26B38 reserved for interactive elements.",
  requiredSections: [],
  pageScope: "multi",
  source: "intake-planner",
  requestText: LANTERNWORKS_REQUEST,
  requested: verifyRequested(JSON.parse(readFileSync(path.join(FX, "requested.json"), "utf-8")), LANTERNWORKS_REQUEST).requested,
});
const checked = validateSiteContent(lanternworksFixed(), brief);
const content = checked.content!;
const svg = readFileSync(path.join(ROOT, "clients", "lanternworks-studio", "logo.svg"));
const inspected = inspectLogo(svg, "image/svg+xml");
const logo = loadLogoAsset({ ...inspected, path: `uploads/0b7c3f7e-1d2a-4c55-9e8f-2a1b3c4d5e6f/${inspected.sha256}.svg` }, svg);
const brand: BrandExpectations = trackBBrand(content, brief, true);
const PACKAGE_2 = ["render.logo-visible", "render.mobile-action-visible", "render.accent-usage", "render.motion-coverage"];
let site: TrackBBuild;

before(async () => {
  assert.deepEqual(checked.errors, [], "the Lanternworks fixture is valid content");
  site = await buildTrackBSite(content, { logo, accentActionsOnly: brand.accentActionsOnly });
}, { timeout: 300_000 });

function writeSite(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "rqa-brand-"));
  const bin = new Set(site.binary);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), bin.has(name) ? Buffer.from(body, "base64") : body);
  }
  return dir;
}
const out = () => mkdtempSync(path.join(tmpdir(), "rqa-brand-out-"));
const failing = (r: RenderedRun) => r.results.filter((x) => !x.passed).map((x) => x.checkId);
const allDetails = (r: RenderedRun) => r.results.filter((x) => !x.passed).flatMap((x) => x.details).join("\n");
/** The home page with planted CSS before </head>. */
const plantedCss = (css: string) => ({ ...site.files, "index.html": site.files["index.html"]!.replace("</head>", `<style>/* SYNTHETIC planted fixture */${css}</style></head>`) });
const runHome = (files: Record<string, string>) => runRenderedQa(writeSite(files), { outDir: out(), pages: ["index.html"], budget: TRACK_B_BUDGET, lighthouse: false, brand });

test("brand expectations come from code: logo on, accent reserved for actions, the client's button label", () => {
  assert.equal(brand.logo, true);
  assert.equal(brand.accentActionsOnly, true);
  assert.equal(brand.accent, "#F26B38");
  assert.equal(brand.primaryActionLabel, "Book a discovery call");
});

test(`clean Lanternworks site (${STARTER_VERSION}): every rendered check passes, including the four Package 2 checks, on every page`, { timeout: 600_000 }, async () => {
  const r = await runRenderedQa(writeSite(site.files), { outDir: out(), pages: site.pages, budget: TRACK_B_BUDGET, lighthouse: false, brand });
  for (const id of PACKAGE_2) assert.ok(r.results.some((x) => x.checkId === id), `${id} ran`);
  assert.deepEqual(failing(r), [], allDetails(r));
});

test("planted fixture: the header logo squashed to 4 px fails render.logo-visible only", { timeout: 300_000 }, async () => {
  const r = await runHome(plantedCss(".brand-logo{height:4px!important;width:20px!important}"));
  assert.deepEqual(failing(r).filter((id) => PACKAGE_2.includes(id)), ["render.logo-visible"], allDetails(r));
  assert.match(allDetails(r), /1440px: the header logo is \d+x4 px/);
});

test("planted fixture: every primary-action control hidden on phones fails render.mobile-action-visible only", { timeout: 300_000 }, async () => {
  const r = await runHome(plantedCss("@media (max-width: 959px){.btn,.action-bar{display:none!important}}"));
  assert.deepEqual(failing(r).filter((id) => PACKAGE_2.includes(id)), ["render.mobile-action-visible"], allDetails(r));
  assert.match(allDetails(r), /375px: no visible "Book a discovery call" control at the top/);
});

test("planted fixture: a section filled with the accent fails render.accent-usage only", { timeout: 300_000 }, async () => {
  const r = await runHome(plantedCss(`main section:nth-of-type(2){background:${brand.accent}!important}`));
  assert.deepEqual(failing(r).filter((id) => PACKAGE_2.includes(id)), ["render.accent-usage"], allDetails(r));
  assert.match(allDetails(r), /is filled with the accent, which the brief reserves for buttons and links/);
});

test("planted fixture: every animation and transition removed fails render.motion-coverage only", { timeout: 300_000 }, async () => {
  const r = await runHome(plantedCss("*,*::before,*::after{animation:none!important;transition:none!important}"));
  // Script-driven moments (the statement's word lighting) still move, so only the CSS-animated sections go still.
  assert.deepEqual(failing(r).filter((id) => PACKAGE_2.includes(id)), ["render.motion-coverage"], allDetails(r));
  assert.match(allDetails(r), /section\(s\) show no motion while the page loads and scrolls/);
});
