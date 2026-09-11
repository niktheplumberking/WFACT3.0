/**
 * This IS the Manual's Phase 5 exit check, run as a real, automated test: "A deliberately broken
 * test build gets caught and returned before being marked done." `broken.html` violates all 6
 * checks at once; `clean.html` passes all 6. Both fixtures are read from disk, not inlined, so
 * they're inspectable independently of this test file (same spirit as
 * `packages/hermes/test/memoryTools.test.ts` reading the real `memory/context.md`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CHECK_REGISTRY, runChecks } from "../src/registry.js";
import type { VerificationContext } from "../src/checks/types.js";

const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

test("registry has exactly the 6 checks named in the Operator's Manual's Phase 5 section", () => {
  const ids = CHECK_REGISTRY.map((c) => c.id).sort();
  assert.deepEqual(ids, [
    "image-optimization",
    "isolation-check",
    "no-console-errors",
    "required-sections",
    "responsive-check",
    "secrets-scan",
  ]);
});

test("deliberately broken build: every single check catches it", () => {
  const ctx: VerificationContext = {
    html: loadFixture("broken.html"),
    clientSlug: "dreamsign-pilot",
    requiredSections: ["hero", "contact"],
    otherClientSlugs: ["bennett-co"],
  };

  const results = runChecks(ctx);

  for (const result of results) {
    assert.equal(result.passed, false, `expected ${result.checkId} to fail against broken.html`);
    assert.ok(result.details.length > 0, `expected ${result.checkId} to explain why it failed`);
  }

  const byId = Object.fromEntries(results.map((r) => [r.checkId, r]));
  assert.match(byId["secrets-scan"]!.details.join(" "), /Anthropic API key/i);
  assert.match(byId["responsive-check"]!.details.join(" "), /viewport/i);
  assert.match(byId["responsive-check"]!.details.join(" "), /@media/i);
  assert.match(byId["no-console-errors"]!.details.join(" "), /external src|syntax error/i);
  assert.match(byId["image-optimization"]!.details.join(" "), /alt attribute/i);
  assert.match(byId["isolation-check"]!.details.join(" "), /bennett-co/);
  assert.match(byId["required-sections"]!.details.join(" "), /hero|contact/);
});

test("clean build: every single check passes it", () => {
  const ctx: VerificationContext = {
    html: loadFixture("clean.html"),
    clientSlug: "dreamsign-pilot",
    requiredSections: ["hero", "contact"],
    otherClientSlugs: ["bennett-co"],
  };

  const results = runChecks(ctx);

  for (const result of results) {
    assert.equal(
      result.passed,
      true,
      `expected ${result.checkId} to pass against clean.html, got: ${result.details.join("; ")}`,
    );
    assert.deepEqual(result.details, []);
  }
});

test("isolation check never flags a client against its own slug", () => {
  const ctx: VerificationContext = {
    html: '<p>dreamsign-pilot builds pages for dreamsign-pilot.</p>',
    clientSlug: "dreamsign-pilot",
    requiredSections: [],
    otherClientSlugs: ["dreamsign-pilot", "bennett-co"],
  };
  const results = runChecks(ctx, CHECK_REGISTRY.filter((c) => c.id === "isolation-check"));
  assert.equal(results[0]!.passed, true);
});
