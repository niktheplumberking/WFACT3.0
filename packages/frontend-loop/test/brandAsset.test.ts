/**
 * The client's logo (intake slice, 2026-10-14): upload checks, the brief record, and placement by the Track A
 * starter. The SVG checks matter because the file is served from the client's own domain. Fixture logo: the
 * SYNTHETIC Lanternworks Studio logo.
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  briefRequiresLogo,
  clearProvidedLogoAssets,
  inspectLogo,
  loadLogoAsset,
  logoAssetFor,
  logoDisplaySize,
  LogoError,
  parseBriefLogo,
  provideLogoAsset,
  sha256Hex,
  type BriefLogo,
} from "../src/brandAsset.js";
import { briefFactSources, loadBrief, parseBrief } from "../src/brief.js";
import { validateSiteContent, type SiteContent } from "../src/trackA/content.js";
import { renderSite } from "../src/trackA/render.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const LOGO = readFileSync(path.join(ROOT, "clients", "lanternworks-studio", "logo.svg"));
const UPLOADER = "0b7c3f7e-1d2a-4c55-9e8f-2a1b3c4d5e6f";

function record(data: Buffer = LOGO, mime = "image/svg+xml"): BriefLogo {
  const r = inspectLogo(data, mime);
  const ext = mime === "image/svg+xml" ? "svg" : mime === "image/png" ? "png" : "webp";
  return { ...r, path: `uploads/${UPLOADER}/${r.sha256}.${ext}` };
}

function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

afterEach(() => clearProvidedLogoAssets());

test("the Lanternworks SVG logo passes and its viewBox gives the size", () => {
  const r = inspectLogo(LOGO, "image/svg+xml");
  assert.equal(r.width, 240);
  assert.equal(r.height, 48);
  assert.equal(r.sha256, sha256Hex(LOGO));
  assert.deepEqual(logoDisplaySize(r), { width: 160, height: 32 }, "a wide mark (5:1) shows 32 px tall");
});

test("PNG size is read from the header; a renamed file is refused", () => {
  assert.deepEqual({ ...inspectLogo(png(400, 400), "image/png"), sha256: "x" }, { mime: "image/png", sha256: "x", bytes: 33, width: 400, height: 400 });
  assert.throws(() => inspectLogo(LOGO, "image/png"), /not a valid PNG/);
  assert.throws(() => inspectLogo(png(1, 1), "image/jpeg"), /SVG, PNG or WebP/);
});

test("refuses empty, oversized and sizeless files", () => {
  assert.throws(() => inspectLogo(Buffer.alloc(0), "image/svg+xml"), /empty/);
  assert.throws(() => inspectLogo(Buffer.alloc(600 * 1024, 32), "image/svg+xml"), /limit is 512 KB/);
  assert.throws(() => inspectLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'), "image/svg+xml"), /viewBox/);
});

test("an SVG that could run code or load something is refused, whatever its case or spacing", () => {
  const svg = (inner: string, attrs = "") => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"${attrs}>${inner}</svg>`);
  const bad: [Buffer, RegExp][] = [
    [svg("<script>alert(1)</script>"), /not allowed in a logo \(<script>\)/],
    [svg("<SCRIPT >alert(1)</SCRIPT>"), /<script>/],
    [svg("", ' onload="alert(1)"'), /event handler/],
    [svg('<rect ONCLICK = "x()"/>'), /event handler/],
    [svg('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject>'), /<foreignobject>/],
    [svg('<image href="https://evil.example/x.png"/>'), /<image>/],
    [svg('<use href="//evil.example/s.svg#a"/>'), /outside the file/],
    [svg('<use xlink:href="https://evil.example/s.svg#a"/>'), /outside the file/],
    [svg('<rect style="fill:url(https://evil.example/p)"/>'), /style reference to something outside/],
    [svg("<style>@import url(x.css);</style>"), /style import/],
    [svg('<a href="javascript:alert(1)"><rect/></a>'), /script link/],
    [svg('<a href="#x"><rect/></a>'), /<a>/],
    [svg('<set attributeName="href" to="#x"/>'), /<set>/],
    [Buffer.from('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 1 1"></svg>'), /DOCTYPE/],
    [Buffer.from('<html><svg viewBox="0 0 1 1"></svg></html>'), /<html>/],
    // Independent review 2026-10-14 (all accepted by the first, ban-list version):
    [svg("<x:script>alert(1)</x:script>"), /namespaced element <x:script>/],
    [svg('<x:foreignObject><div/></x:foreignObject>'), /namespaced element/],
    [svg('<x:set attributeName="href" to="javascript:alert(1)"/>'), /namespaced|script link/],
    [svg('<use href="&#104;ttps://evil.test/p.png"/>'), /encoded characters/],
    [svg("<style>@\\69mport url(x)</style>"), /escaped characters/],
    [svg('<rect style="fill:url(\\68ttps://evil.test)"/>'), /escaped characters/],
    [svg('<use href="data:image/svg+xml;base64,PHN2Zy8+"/>'), /data: URL/],
    [svg("<![CDATA[<script>x</script>]]>"), /CDATA/],
  ];
  for (const [data, why] of bad) assert.throws(() => inspectLogo(data, "image/svg+xml"), (e: unknown) => e instanceof LogoError && why.test(e.message), data.toString());
});

test("an SVG with an XML declaration, a comment and an internal #fragment reference is fine", () => {
  const withUse = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><defs><symbol id="s"><path d="M0 0h1"/></symbol></defs><use xlink:href="#s"/><text>A &amp; B</text></svg>');
  assert.equal(inspectLogo(withUse, "image/svg+xml").width, 10, "internal <use>, xlink, and &amp; are fine");
  const ok = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<!-- exported -->\n<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="120" height="40"/></svg>\n');
  assert.equal(inspectLogo(ok, "image/svg+xml").width, 120);
});

test("the brief keeps a valid logo record and refuses a tampered one", () => {
  const brief = JSON.parse(readFileSync(path.join(ROOT, "clients", "summit-line-roofing", "brief.json"), "utf-8"));
  const logo = record();
  assert.deepEqual(parseBrief({ ...brief, logo }).logo, logo, "parseBrief must not drop the logo");
  assert.match(briefFactSources(parseBrief({ ...brief, logo })).join("\n"), /logo file is supplied/);
  assert.throws(() => parseBrief({ ...brief, logo: { ...logo, path: "uploads/../secrets.svg" } }), /uploaded SVG, PNG or WebP/);
  assert.throws(() => parseBrief({ ...brief, logo: { ...logo, sha256: "0".repeat(64) } }), /uploaded SVG/, "path and fingerprint must agree");
  assert.throws(() => parseBriefLogo({ ...logo, bytes: 10 * 1024 * 1024 }), LogoError);
});

test("the build refuses bytes that differ from the approved fingerprint", () => {
  const logo = record();
  assert.equal(loadLogoAsset(logo, LOGO).file, "logo.svg");
  const swapped = Buffer.from(LOGO.toString().replace("#14213D", "#000000"));
  assert.throws(() => loadLogoAsset(logo, swapped), /fingerprint differs/);
});

test("a brief that names a logo cannot be built without its bytes", () => {
  const brief = { ...loadBrief(path.join(ROOT, "clients", "summit-line-roofing", "brief.json")), logo: record() };
  assert.throws(() => logoAssetFor(brief), /not loaded before the build/);
  provideLogoAsset(loadLogoAsset(brief.logo, LOGO));
  assert.equal(logoAssetFor(brief)!.sha256, brief.logo.sha256);
  assert.equal(logoAssetFor({}), null);
});

test("Track A places the logo in the header, the footer chip and the favicon, on every page and the 404", () => {
  const brief = loadBrief(path.join(ROOT, "clients", "summit-line-roofing", "brief.json"));
  const fixture = JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", "track-a", "summit-line.content.json"), "utf-8")) as SiteContent;
  const content = validateSiteContent(fixture, brief).content!;
  const asset = loadLogoAsset(record(), LOGO);
  const site = renderSite(content, { logo: asset });
  // Track A 1.3.0: the uploaded bytes plus width/height from the viewBox (servedLogoData), so the SVG cannot collapse.
  assert.equal(site.files["logo.svg"], LOGO.toString("utf-8").replace("<svg ", '<svg width="240" height="48" '), "the file ships with the site, as text, sized");
  assert.ok(!site.binary.includes("logo.svg"));
  for (const page of site.pages) {
    const html = site.files[page]!;
    assert.match(html, /<a class="brand" href="index.html"><img class="brand-logo" src="logo.svg" alt="[^"]+" width="160" height="32"/, `${page}: header logo`);
    assert.match(html, /<p class="brand-logo-chip"><img class="brand-logo" src="logo.svg"/, `${page}: footer logo`);
    assert.match(html, /<link rel="icon" href="logo.svg" type="image\/svg\+xml">/, `${page}: favicon`);
    assert.doesNotMatch(html, /class="icon brand-mark"/, `${page}: no stand-in mark`);
  }
  assert.match(site.files["404.html"]!, /src="\/logo.svg"/, "the 404 is served at any depth, so its logo is root-relative");
  assert.match(site.files["404.html"]!, /<link rel="icon" href="\/logo.svg"/);
  // A PNG logo is stored as base64 and listed as binary.
  const p = png(300, 300);
  const pngSite = renderSite(content, { logo: loadLogoAsset(record(p, "image/png"), p) });
  assert.ok(pngSite.binary.includes("logo.png"));
  assert.equal(Buffer.from(pngSite.files["logo.png"]!, "base64").length, 33);
  // Without a logo nothing changes: the text wordmark stays.
  assert.match(renderSite(content).files["index.html"]!, /class="icon brand-mark"/);
});

test("briefRequiresLogo reads the brief's own words", () => {
  assert.ok(briefRequiresLogo("Navy, paper and orange only; the provided logo.svg used as-is (no redrawing)."));
  assert.ok(briefRequiresLogo("Use our existing logo in the header."));
  assert.ok(briefRequiresLogo("Logo is fixed and locked."));
  assert.equal(briefRequiresLogo("Warm, plain-spoken tone. Orange accent."), false);
  assert.equal(briefRequiresLogo("We do not have a logo yet."), false);
  assert.equal(briefRequiresLogo("Design a logo-free, type-led look."), false);
  // Independent review 2026-10-14: these halted a good run before it started.
  assert.equal(briefRequiresLogo("Don't use a logo."), false);
  assert.equal(briefRequiresLogo("Use warm tones; logo to be designed"), false);
  assert.equal(briefRequiresLogo("We need a new logo."), false);
  assert.ok(briefRequiresLogo("Their logo should appear in the header."));
});

test("the Cockpit's browser check uses the very same SVG policy file (byte-identical copy)", () => {
  const build = readFileSync(path.join(ROOT, "packages", "frontend-loop", "src", "svgPolicy.ts"), "utf-8");
  const cockpit = readFileSync(path.join(ROOT, "apps", "cockpit", "src", "lib", "svgPolicy.ts"), "utf-8");
  assert.equal(cockpit, build, "copy packages/frontend-loop/src/svgPolicy.ts to apps/cockpit/src/lib/svgPolicy.ts");
});
