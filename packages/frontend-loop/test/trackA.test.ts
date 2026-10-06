/**
 * Step 4B M3: Track A content, palette, renderer, builder loop and agent. No network: the builder and
 * reviewer are MockModelClients, the content is the SYNTHETIC Summit Line fixture.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MockModelClient } from "../src/modelClient.js";
import { loadBrief } from "../src/brief.js";
import { validateSiteContent, extractJson, inBrief, type SiteContent } from "../src/trackA/content.js";
import { buildPalette, contrast } from "../src/trackA/palette.js";
import { renderSite, STARTER_VERSION } from "../src/trackA/render.js";
import { TrackALoop, trackASystemPrompt } from "../src/trackA/loop.js";
import { createTrackABuilderAgent } from "../src/trackA/agent.js";
import { createSeedRegistry, permissionGateFor, withPermissionGate } from "@wfact/agent-runtime";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const brief = loadBrief(path.join(ROOT, "clients", "summit-line-roofing", "brief.json"));
const FIXTURE_TEXT = readFileSync(path.join(import.meta.dirname, "fixtures", "track-a", "summit-line.content.json"), "utf-8");
const fixture = () => JSON.parse(FIXTURE_TEXT) as SiteContent & { _doc?: string };

test("the SYNTHETIC Summit Line fixture is valid content", () => {
  const { content, errors } = validateSiteContent(fixture(), brief);
  assert.deepEqual(errors, []);
  assert.equal(content!.pages.length, 4);
});

test("renders a deterministic multi-page site: one file per page, nav order kept", () => {
  const content = validateSiteContent(fixture(), brief).content!;
  const a = renderSite(content);
  const b = renderSite(content);
  assert.deepEqual(a.pages, ["index.html", "services.html", "faq.html", "contact.html"]);
  assert.deepEqual(a, b, "same content must give the same bytes (the checkpoint hash depends on it)");
  for (const page of a.pages) {
    const html = a.files[page]!;
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${page}: exactly one h1`);
    assert.match(html, /<a class="skip" href="#main">/, `${page}: skip link`);
    assert.match(html, /<html lang="en">/);
    assert.match(html, new RegExp(`content="WFACT ${STARTER_VERSION.replace(/[./]/g, "\\$&")}"`));
    assert.ok(html.trimEnd().endsWith("</html>"), `${page}: nothing after </html>`);
    assert.doesNotMatch(html, /<link[^>]+stylesheet|<script[^>]+src=|fonts\.googleapis/i, `${page}: no external CSS, scripts or web fonts`);
    for (const other of a.pages) assert.ok(html.includes(`href="${other}"`), `${page} links to ${other}`);
  }
});

test("SAMPLE facts are labelled where they appear and never published as structured data", () => {
  const site = renderSite(validateSiteContent(fixture(), brief).content!);
  const home = site.files["index.html"]!;
  assert.match(home, /555-0142<\/span><\/a> <span class="sample">SAMPLE<\/span>/);
  const ld = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!);
  assert.equal(ld.name, "Summit Line Roofing");
  assert.equal(ld.telephone, undefined, "a SAMPLE phone is never published as a fact");
  assert.match(home, /<!-- OPEN QUESTION for a human \(not shown on the page\): Should package prices/);
});

test("the request form is labelled, required fields are announced, and the primary action reaches it", () => {
  const site = renderSite(validateSiteContent(fixture(), brief).content!);
  const contact = site.files["contact.html"]!;
  for (const id of ["rq-name", "rq-phone", "rq-address", "rq-need", "rq-time"]) assert.match(contact, new RegExp(`<label for="${id}">`));
  assert.match(contact, /<form id="request" data-request novalidate/);
  assert.match(contact, /not connected yet, so nothing was sent/);
  assert.match(site.files["index.html"]!, /href="contact.html#request">Request a free roof inspection/);
});

test("palette: the brand accent is darkened just enough for text, and an unreadable palette is refused", () => {
  const { palette } = buildPalette({ ink: "#1B2622", paper: "#F6F1E7", accent: "#B5642A", deep: "#1F3D36" });
  assert.ok(contrast("#B5642A", "#F6F1E7") < 4.5, "the raw copper fails AA on the cream (the reason accentInk exists)");
  assert.ok(contrast(palette!.accentInk, palette!.paper) >= 4.5);
  assert.ok(contrast(palette!.onAccent, palette!.accentInk) >= 4.5);
  assert.ok(contrast(palette!.onDeep, palette!.deep) >= 4.5);
  assert.ok(contrast(palette!.muted, palette!.paper) >= 4.5 && contrast(palette!.muted, palette!.surface) >= 4.5);
  const bad = buildPalette({ ink: "#BBBBBB", paper: "#FFFFFF", accent: "#FFFF00", deep: "#888888" });
  assert.equal(bad.palette, null);
  assert.ok(bad.problems.some((p) => /ink #BBBBBB on paper/.test(p)));
});

test("validation sends back exact problems: invented facts, missing required sections, structure", () => {
  const c = fixture();
  c.business.phone = { value: "(555) 014-7732", source: "brief" };
  c.business.serviceAreas = { values: ["Springfield"], source: "brief" };
  c.pages[0]!.sections = c.pages[0]!.sections.filter((s) => s.id !== "process");
  c.pages[3]!.sections[1]!.id = "request";
  c.primaryAction.page = "faq";
  const { content, errors } = validateSiteContent(c, brief);
  assert.equal(content, null);
  const all = errors.join("\n");
  assert.match(all, /business\.phone: "\(555\) 014-7732" is marked source "brief" but is not in the brief/);
  assert.match(all, /serviceAreas: "Springfield" is not in the brief/);
  assert.match(all, /requires a section with id "process"/);
  assert.match(all, /id "request" is reserved/);
  assert.match(all, /primaryAction\.page "faq" has no "contact" section/);

  const schema = validateSiteContent({ schemaVersion: "track-a/1", pages: [] }, brief);
  assert.ok(schema.errors.length > 0 && schema.errors.every((e) => /:/.test(e)), "schema errors name their JSON path");
});

test("inBrief matches the brief's own SAMPLE phone by digits and text facts case-insensitively", () => {
  const text = `${brief.goal}\n${brief.brandNotes}`;
  assert.equal(inBrief("555 0142", text), true);
  assert.equal(inBrief("HELLO@SUMMITLINEROOFING.EXAMPLE", text), true);
  assert.equal(inBrief("555-0199", text), false);
});

test("extractJson tolerates a fence around the object and refuses non-JSON", () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => extractJson("no object here"), /no JSON object/);
});

test("the builder prompt carries the schema, the banned claims and every rulebook rule id", () => {
  const prompt = trackASystemPrompt();
  for (const id of ["DR-THREE-CARD-ROW", "DR-EYEBROW-OVERUSE", "DQ-CONTENT-HIERARCHY"]) assert.ok(prompt.includes(id));
  assert.match(prompt, /track-a\/1/);
  assert.match(prompt, /warranties, guarantees/);
  assert.match(prompt, /Output ONLY one JSON object/);
});

test("loop: invalid JSON is sent back with the exact errors, then a valid site is reviewed and approved", async () => {
  const builder = new MockModelClient((_req, i) => (i === 0 ? '{"schemaVersion":"track-a/1","pages":[]}' : FIXTURE_TEXT));
  const reviewer = new MockModelClient(() => "VERDICT: APPROVED");
  const result = await new TrackALoop({ builderModel: builder, evaluatorModel: reviewer }).run(brief);
  assert.equal(result.approved, true);
  assert.equal(builder.calls.length, 2, "one generate + one validation fix");
  assert.match(builder.calls[1]!.user, /\[content\.schema\] business: /);
  assert.deepEqual(result.site!.pages, ["index.html", "services.html", "faq.html", "contact.html"]);
  assert.equal(result.finalHtml, result.site!.files["index.html"]);
  assert.equal(JSON.parse(result.site!.contentJson).business.name, "Summit Line Roofing");
  assert.match(reviewer.calls[0]!.user, /site content JSON to review/);
});

test("loop: content that stays invalid escalates with the reasons instead of retrying forever", async () => {
  const builder = new MockModelClient(() => "not json at all");
  const reviewer = new MockModelClient(() => "VERDICT: APPROVED");
  const result = await new TrackALoop({ builderModel: builder, evaluatorModel: reviewer, maxValidationAttempts: 2 }).run(brief);
  assert.equal(result.approved, false);
  assert.equal(result.needsHuman, true);
  assert.match(result.escalationReason!, /still invalid after 2 attempts/);
  assert.equal(builder.calls.length, 2);
  assert.equal(reviewer.calls.length, 0, "no review of content that never validated");
});

test("loop: reviewer changes go back to the builder; the round cap escalates", async () => {
  const builder = new MockModelClient(() => FIXTURE_TEXT);
  const reviewer = new MockModelClient(() => "VERDICT: CHANGES_REQUESTED\nISSUES:\n- index/hero: say what the business does first");
  const result = await new TrackALoop({ builderModel: builder, evaluatorModel: reviewer, maxRounds: 2 }).run(brief);
  assert.equal(result.approved, false);
  assert.equal(result.rounds.length, 2);
  assert.match(builder.calls[1]!.user, /index\/hero: say what the business does first/);
  assert.ok(result.site, "the last built site is kept for the human");
});

test("revise(): QA's failed checks reach the builder with the current content; a vague retry is refused", async () => {
  const builder = new MockModelClient(() => FIXTURE_TEXT);
  const reviewer = new MockModelClient(() => "VERDICT: APPROVED");
  const loop = new TrackALoop({ builderModel: builder, evaluatorModel: reviewer });
  await assert.rejects(() => loop.revise(brief, FIXTURE_TEXT, []), /vague retry/);
  const result = await loop.revise(brief, FIXTURE_TEXT, ["[render.links] services.html: link \"Gutters\" (gutters.html) returns HTTP 404"]);
  assert.equal(result.approved, true);
  assert.match(builder.calls[0]!.user, /\[render\.links\] services\.html/);
  assert.match(builder.calls[0]!.user, /Current content JSON:\n\{/);
});

test("agent: Track A revisions need the content JSON; summary lists the pages", async () => {
  const agent = createTrackABuilderAgent({
    builderModel: new MockModelClient(() => FIXTURE_TEXT),
    evaluatorModel: new MockModelClient(() => "VERDICT: APPROVED"),
  });
  assert.equal(agent.role, "front-end-builder");
  assert.equal(agent.parseInput({ brief }).template.id, "track-a");
  assert.throws(() => agent.parseInput({ brief, revision: { html: "<html></html>", issues: ["x"] } }), /contentJson/);
  // Step 6: model calls need a permission gate (runAgent provides one); this direct execute() supplies the role's own.
  const gate = permissionGateFor(createSeedRegistry(), "front-end-builder", { taskId: null, runId: null, entitySlug: brief.entitySlug, clientSlug: brief.clientSlug, audit: null });
  const out = await withPermissionGate(gate, () => agent.execute(agent.parseInput({ brief }), {} as never));
  assert.deepEqual(agent.summarize!(out).pages, ["index.html", "services.html", "faq.html", "contact.html"]);
});

test("validation enforces page structure: home page size, thin pages, one cta, no three list-like sections in a row", () => {
  const c = fixture();
  const home = c.pages[0]!;
  const services = c.pages[1]!;
  services.sections = [services.sections[0]!, services.sections[1]!, { type: "steps", id: "how", heading: "How", steps: [{ title: "a", text: "a" }, { title: "b", text: "b" }, { title: "c", text: "c" }] }, services.sections[2]!];
  home.sections = [...home.sections, { type: "cta", id: "again", heading: "Again", text: "Again." }, { type: "prose", id: "more", heading: "More", paragraphs: ["More."] }, { type: "prose", id: "even-more", heading: "Even more", paragraphs: ["More."] }];
  c.pages[2]!.sections = [c.pages[2]!.sections[0]!];
  const all = validateSiteContent(c, brief).errors.join("\n");
  assert.match(all, /pages\[0\] \(index\) has 7 sections; keep the home page to 6/);
  assert.match(all, /pages\[0\] \(index\) has more than one "cta"/);
  assert.match(all, /pages\[1\] \(services\): sections 0-2 \(services, packages, steps\) are three list-like layouts in a row/);
  assert.match(all, /pages\[2\] \(faq\) has one section/);
});

test("palette: the tinted section background really differs from the paper (regression: it silently fell back to paper)", () => {
  const { palette } = buildPalette({ ink: "#1F3D36", paper: "#F6F1E7", accent: "#B5642A", deep: "#1F3D36" });
  assert.notEqual(palette!.surface, palette!.paper);
  assert.ok(contrast(palette!.accentInk, palette!.surface) >= 4.5 && contrast(palette!.ink, palette!.surface) >= 4.5);
});

test("testimonials only quote the brief: an invented one, even labelled SAMPLE, is fake social proof (job f696ba43)", () => {
  const c = fixture();
  const quote = (text: string, source: "brief" | "sample") => ({ text, attribution: "Maren, homeowner", source });
  c.pages[2]!.sections.splice(1, 0, { type: "testimonials", id: "proof", heading: "What homeowners say", quotes: [quote("Clear about what could wait.", "sample")] } as never);
  let all = validateSiteContent(c, brief).errors.join("\n");
  assert.match(all, /quotes\[0\]: an invented testimonial, even labelled SAMPLE, is fake social proof \(DR-FAKE-SOCIAL-PROOF\)/);
  (c.pages[2]!.sections[1] as { quotes: unknown[] }).quotes = [quote("Clear about what could wait.", "brief")];
  all = validateSiteContent(c, brief).errors.join("\n");
  assert.match(all, /quotes\[0\]: marked source "brief" but the quote is not in the brief/);
  const sourced = { ...brief, brandNotes: `${brief.brandNotes} Real customer quote: "Clear about what could wait."` };
  assert.deepEqual(validateSiteContent(c, sourced).errors, [], "a quote the brief supplies is allowed");
  assert.match(trackASystemPrompt(), /Never invent a testimonial, not even one labelled/);
});

test("a single landing page brief gets exactly one page; a multi-page brief still needs 3+", () => {
  const single = { ...brief, pageScope: "single" as const };
  const multiPage = validateSiteContent(fixture(), single).errors.join("\n");
  assert.match(multiPage, /the brief asks for a single landing page, but there are 4 pages/);

  const c = fixture();
  const [home, services, faq, contact] = c.pages;
  home!.sections = [home!.sections[0]!, home!.sections[1]!, services!.sections[1]!, contact!.sections[1]!, home!.sections[2]!, faq!.sections[0]!, contact!.sections[0]!, home!.sections[3]!];
  c.pages = [home!];
  c.primaryAction.page = "index";
  for (const it of (home!.sections[1] as { items: { page?: string }[] }).items) delete it.page; // no other pages to link to
  assert.deepEqual(validateSiteContent(c, single).errors, [], "one page with every required section and the form passes");
  assert.match(validateSiteContent(c, brief).errors.join("\n"), /1 page\(s\); a multi-page site has 3 to 8/);

  const site = renderSite(validateSiteContent(c, single).content!);
  assert.deepEqual(site.pages, ["index.html"]);
  assert.doesNotMatch(site.files["index.html"]!, /<nav aria-label="Footer">/, "no footer page list with one page");
  assert.match(site.files["index.html"]!, /<a class="btn" href="#request">/, "the primary action stays on the page");
  assert.match(trackASystemPrompt("single"), /SINGLE landing page/);
  assert.doesNotMatch(trackASystemPrompt("multi"), /SINGLE landing page/);
});
