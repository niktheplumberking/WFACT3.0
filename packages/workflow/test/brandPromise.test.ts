/**
 * Build-quality Package 2: a Track B run's brand promise is computed from the brief and the SAVED content (so a resumed run
 * gets it too) and never from the page; Track A and unreadable content get none.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBrief } from "@wfact/frontend-loop/brief";
import { lanternworksFixed, LANTERNWORKS_REQUEST } from "../../frontend-loop/test/lanternworksFixed.js";
import { brandPromiseFor } from "../src/buildAndVerify.js";

const brief = parseBrief({
  clientSlug: "lanternworks-studio", entitySlug: "bennett-co", projectName: "x", goal: "x", brandNotes: "Three fixed colours.",
  requiredSections: [], pageScope: "multi", source: "intake-planner", requestText: LANTERNWORKS_REQUEST,
});

test("Track B content: the brand promise names the client's accent, the action label and the accent rule from the request", () => {
  const p = brandPromiseFor(JSON.stringify(lanternworksFixed()), brief);
  assert.ok("brand" in p);
  assert.deepEqual({ ...p.brand, accentDerived: p.brand.accentDerived.length }, { logo: false, primaryActionLabel: "Book a discovery call", accent: "#F26B38", accentDerived: 1, accentActionsOnly: true });
});

test("anything else gets no brand promise (Track A content, broken JSON)", () => {
  assert.deepEqual(brandPromiseFor(JSON.stringify({ schemaVersion: "track-a/1" }), brief), {});
  assert.deepEqual(brandPromiseFor("{not json", brief), {});
});
