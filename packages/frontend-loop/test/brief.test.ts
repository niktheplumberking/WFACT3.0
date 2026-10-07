import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { parseBrief, InvalidBriefError, loadBrief } from "../src/brief.js";
import { repoRoot } from "../src/paths.js";

const validBrief = {
  clientSlug: "dreamsign-pilot",
  entitySlug: "dreamsign",
  projectName: "DreamSign Homepage",
  goal: "A one-page homepage.",
  requiredSections: ["hero", "contact"],
  brandNotes: "Clean, restrained.",
  source: "placeholder-2.0-case",
};

test("parseBrief accepts a well-formed brief", () => {
  const brief = parseBrief(validBrief);
  assert.equal(brief.clientSlug, "dreamsign-pilot");
  assert.equal(brief.source, "placeholder-2.0-case");
});

test("parseBrief rejects a missing required field", () => {
  const { goal, ...rest } = validBrief;
  assert.throws(() => parseBrief(rest), InvalidBriefError);
});

test('parseBrief rejects an invalid "source" value', () => {
  assert.throws(() => parseBrief({ ...validBrief, source: "made-up" }), InvalidBriefError);
});

test("parseBrief rejects requiredSections that isn't a string array", () => {
  assert.throws(() => parseBrief({ ...validBrief, requiredSections: "hero" }), InvalidBriefError);
});

test("parseBrief accepts an optional templatePreference", () => {
  const brief = parseBrief({ ...validBrief, templatePreference: "bold-startup" });
  assert.equal(brief.templatePreference, "bold-startup");
});

test("loadBrief reads and parses the real placeholder pilot brief on disk", () => {
  const brief = loadBrief(join(repoRoot(), "clients", "dreamsign-pilot", "brief.json"));
  assert.equal(brief.clientSlug, "dreamsign-pilot");
  assert.equal(brief.source, "placeholder-2.0-case");
  assert.ok(brief.requiredSections.length > 0);
});

test("loadBrief reads and parses the synthetic provisional Summit Line Roofing brief", () => {
  const brief = loadBrief(join(repoRoot(), "clients", "summit-line-roofing", "brief.json"));
  assert.equal(brief.clientSlug, "summit-line-roofing");
  assert.equal(brief.entitySlug, "bennett-co");
  assert.equal(brief.source, "synthetic-provisional-2026-09-30");
  assert.deepEqual(brief.requiredSections, ["hero", "services", "packages", "process", "faq", "contact"]);
});

test("Step 4D: ownerFacts are validated, kept, and become fact sources", async () => {
  const { briefFactSources, ownerFactLines } = await import("../src/brief.js");
  const brief = parseBrief({ ...validBrief, ownerFacts: [{ key: "phone", label: "Business phone", value: " 0400 111 222 " }] });
  assert.deepEqual(brief.ownerFacts, [{ key: "phone", label: "Business phone", value: "0400 111 222" }]);
  assert.deepEqual(ownerFactLines(brief), ["Business phone: 0400 111 222"]);
  assert.ok(briefFactSources(brief).some((s) => s.includes("0400 111 222")));
  assert.equal(parseBrief(validBrief).ownerFacts, undefined, "a brief without facts is unchanged");
  assert.throws(() => parseBrief({ ...validBrief, ownerFacts: [{ key: "Bad Key", label: "x", value: "y" }] }), InvalidBriefError);
  assert.throws(() => parseBrief({ ...validBrief, ownerFacts: [{ key: "phone", label: "x", value: "" }] }), InvalidBriefError);
  assert.throws(() => parseBrief({ ...validBrief, ownerFacts: "phone" }), InvalidBriefError);
});
