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
