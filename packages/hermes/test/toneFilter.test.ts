import { test } from "node:test";
import assert from "node:assert/strict";
import { applyToneFilter, JARGON_GLOSSARY } from "../src/toneFilter.js";

test("replaces glossary jargon with plain-language equivalents", () => {
  const result = applyToneFilter("We ran a migration and fixed the RLS policy on the schema.");
  assert.equal(result.replacedTerms.includes("migration"), true);
  assert.equal(result.replacedTerms.includes("RLS"), true);
  assert.equal(result.replacedTerms.includes("schema"), true);
  assert.doesNotMatch(result.text, /\bmigration\b/i);
  assert.doesNotMatch(result.text, /\bRLS\b/);
  assert.match(result.text, /database update/);
});

test("longer phrases win over their shorter substrings", () => {
  const result = applyToneFilter("Check the row-level security rules before you deploy.");
  assert.equal(result.text.includes("data-isolation rules"), true);
  // Confirms the phrase-level replacement fired, not a partial match on "security" alone.
  assert.equal(result.replacedTerms.includes("row-level security"), true);
});

test("leaves plain sentences untouched", () => {
  const input = "DreamSign is in onboarding and waiting on a signed brief from the client.";
  const result = applyToneFilter(input);
  assert.equal(result.text, input);
  assert.deepEqual(result.replacedTerms, []);
});

test("flags leftover acronyms the glossary doesn't cover yet", () => {
  const result = applyToneFilter("The PWA build is blocked on a CI issue.");
  assert.equal(result.remainingAcronyms.includes("PWA"), true);
  assert.equal(result.remainingAcronyms.includes("CI"), true);
});

test("glossary has no empty keys or values", () => {
  for (const [term, plain] of Object.entries(JARGON_GLOSSARY)) {
    assert.ok(term.length > 0);
    assert.ok(plain.length > 0);
  }
});
