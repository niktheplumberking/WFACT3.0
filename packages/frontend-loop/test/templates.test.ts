import { test } from "node:test";
import assert from "node:assert/strict";
import { HAND_PICKED_TEMPLATES, selectTemplate } from "../src/templates.js";

test("exactly the hand-picked count the Manual's fallback calls for (2-3 templates)", () => {
  assert.ok(HAND_PICKED_TEMPLATES.length >= 2 && HAND_PICKED_TEMPLATES.length <= 3);
});

test("selectTemplate honors an explicit preference", () => {
  const picked = selectTemplate("bold-startup");
  assert.equal(picked.id, "bold-startup");
});

test("selectTemplate falls back to clean-agency when no preference given", () => {
  const picked = selectTemplate(undefined);
  assert.equal(picked.id, "clean-agency");
});

test("selectTemplate falls back to clean-agency when preference doesn't match any template", () => {
  const picked = selectTemplate("does-not-exist");
  assert.equal(picked.id, "clean-agency");
});

test("every template declares at least one required section", () => {
  for (const t of HAND_PICKED_TEMPLATES) {
    assert.ok(t.requiredSections.length > 0, `${t.id} has no required sections`);
  }
});
