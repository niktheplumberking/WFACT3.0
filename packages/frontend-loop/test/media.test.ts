/**
 * Build-quality Package 3: media slots. The builder describes pictures but never sets a source or asks for a generated
 * image; code decides supplied vs placeholder from the owner's uploads; the home hero and every work item need a slot;
 * team names come only from the client's words; track-b/1 content still validates (upgraded on read).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseBrief } from "../src/brief.js";
import { CONTENT_SCHEMA_VERSION, validateSiteContent, type SiteContent } from "../src/trackB/content.js";
import { inspectImage, jpegSize, loadImageAsset, mediaSlots, parseImageRecord, ImageError } from "../src/media.js";
import { lanternworksFixed, LANTERNWORKS_REQUEST } from "./lanternworksFixed.js";

const JPG = readFileSync(path.join(import.meta.dirname, "fixtures", "lanternworks", "hero-sample.jpg"));
const rec = { ...inspectImage(JPG, "image/jpeg"), path: "" };
rec.path = `uploads/0b7c3f7e-1d2a-4c55-9e8f-2a1b3c4d5e6f/${rec.sha256}.jpg`;
const base = { clientSlug: "lanternworks-studio", entitySlug: "bennett-co", projectName: "x", goal: "x", brandNotes: "x", requiredSections: [], pageScope: "multi", source: "intake-planner", requestText: LANTERNWORKS_REQUEST };
const brief = parseBrief(base);
const withHero = parseBrief({ ...base, images: [{ slot: "index.hero", image: rec }] });
const errorsOf = (c: SiteContent, b = brief) => validateSiteContent(c, b).errors.join("\n");
const heroOf = (c: SiteContent) => c.pages[0]!.sections[0] as Extract<SiteContent["pages"][number]["sections"][number], { type: "hero" }>;

test("schema v2: the fixture is track-b/2, and stored track-b/1 content still validates (upgraded on read)", () => {
  assert.equal(CONTENT_SCHEMA_VERSION, "track-b/2");
  const v1 = { ...lanternworksFixed(), schemaVersion: "track-b/1" };
  const r = validateSiteContent(v1, brief);
  assert.deepEqual(r.errors, []);
  assert.equal(r.content!.schemaVersion, "track-b/2");
});

test("the builder never sets a source, never asks for a generated image, and marks 'supplied' only where the owner uploaded one", () => {
  const c = lanternworksFixed();
  heroOf(c).media = { kind: "placeholder", src: "https://picsum.photos/1200", alt: "x", aspect: "16:9", note: "x" };
  assert.match(errorsOf(c), /media index\.hero: remove "src"; the image is set by code/);
  heroOf(c).media = { kind: "generated", alt: "x", aspect: "16:9", note: "x" };
  assert.match(errorsOf(c), /media index\.hero: generated images are not available/);
  heroOf(c).media = { kind: "supplied", alt: "x", aspect: "16:9", note: "x" };
  assert.match(errorsOf(c), /media index\.hero: no image was supplied for this slot; use kind "placeholder"/);
  assert.equal(errorsOf(c, withHero), "", "with the owner's upload for index.hero, 'supplied' is right");
});

test("the home hero and every work item need a media slot", () => {
  const c = lanternworksFixed();
  delete heroOf(c).media;
  for (const p of c.pages) for (const s of p.sections) if (s.type === "work") delete s.items[0]!.media;
  const e = errorsOf(c);
  assert.match(e, /pages\[0\] \(index\) hero "hero": add media/);
  assert.match(e, /items\[0\] \([^)]+\): add media; every work item shows a picture or a labelled placeholder/);
});

test("team: no invented people; members only when the client's words name them", () => {
  const c = lanternworksFixed();
  const about = c.pages.find((p) => p.slug === "about")!;
  about.sections.splice(1, 0, { type: "team", id: "team", heading: "Who we are", intro: "Three people.", members: [{ name: "Maya Chen", role: "Art director" }] });
  assert.match(errorsOf(c), /"Maya Chen" is not named in the client's request or the owner's facts; never invent people/);
  const named = parseBrief({ ...base, requestText: `${LANTERNWORKS_REQUEST}\nThe team: Priya Halden, founder.` });
  (about.sections[1] as { members: { name: string; role?: string }[] }).members = [{ name: "Priya Halden", role: "founder" }];
  assert.equal(errorsOf(c, named), "");
});

test("slot ids are code's: page.section for a single slot, page.section.n for items", () => {
  const slots = mediaSlots(lanternworksFixed(), new Set(["index.hero"]));
  assert.deepEqual(slots.find((s) => s.slot === "index.hero")!.shows, "supplied");
  assert.ok(slots.some((s) => /^work\.work\.1$/.test(s.slot) && s.shows === "placeholder"));
});

test("supplied images: JPEG/PNG/WebP only, at most 2 MB, fingerprint checked; a record must point into the uploads area", () => {
  assert.deepEqual(jpegSize(JPG), { width: 1200, height: 750 });
  assert.throws(() => inspectImage(Buffer.from("<svg/>"), "image/svg+xml"), ImageError);
  assert.throws(() => inspectImage(Buffer.alloc(2 * 1024 * 1024 + 1, 0xff), "image/jpeg"), /limit is 2 MB/);
  assert.throws(() => loadImageAsset(rec, Buffer.concat([JPG, Buffer.from([0])])), /fingerprint differs/);
  assert.equal(loadImageAsset(rec, JPG).file, `media/${rec.sha256.slice(0, 16)}.jpg`);
  assert.throws(() => parseImageRecord({ ...rec, path: "uploads/../etc/passwd.jpg" }), ImageError);
  assert.throws(() => parseBrief({ ...base, images: [{ slot: "Bad Slot", image: rec }] }), /slot id/);
});

test("Track A: the home hero shows a labelled placeholder card, or the owner's image once supplied (and ships it)", async () => {
  const { validateSiteContent: validateA } = await import("../src/trackA/content.js");
  const { renderSite } = await import("../src/trackA/render.js");
  const summit = JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", "track-a", "summit-line.content.json"), "utf-8"));
  const briefA = parseBrief({ ...base, requestText: undefined, clientSlug: "summit-line-roofing" });
  const content = validateA(summit, briefA).content!;
  const plain = renderSite(content);
  assert.match(plain.files["index.html"]!, /data-placeholder="index\.hero"[^>]*aria-label="Image to come: A photo of a recent roof replacement"/);
  const withImage = renderSite(content, { images: new Map([["index.hero", loadImageAsset(rec, JPG)]]) });
  assert.match(withImage.files["index.html"]!, /<img src="media\/[0-9a-f]{16}\.jpg" alt="A Summit Line crew finishing a roof" width="1200" height="750" loading="eager"/);
  assert.doesNotMatch(withImage.files["index.html"]!, /data-placeholder="index\.hero"/);
  assert.ok(withImage.binary.some((f) => /^media\/[0-9a-f]{16}\.jpg$/.test(f)));
  // track-a/1 content (every stored Track A build) still validates, upgraded on read.
  assert.deepEqual(validateA({ ...summit, schemaVersion: "track-a/1" }, briefA).errors, []);
});
