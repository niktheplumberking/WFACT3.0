import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { costForModel, estimateCostUsd, loadRoutingTable, resolveModelRoute, RoutingError } from "../src/routing.js";

test("the shipped config routes intake to the fast tier and planner to the mid tier (Blueprint §5/§7)", () => {
  const intake = resolveModelRoute("intake", {});
  const planner = resolveModelRoute("planner", {});
  assert.equal(intake.tier, "fast");
  assert.equal(planner.tier, "mid");
  assert.notEqual(intake.model, planner.model, "the split is real, not one model for everything");
  assert.equal(intake.source, "config");
});

test("an env override swaps the model with no code change; its price comes from the one price table", () => {
  const priced = resolveModelRoute("intake", { WFACT_ROUTE_INTAKE: "anthropic:claude-sonnet-5" });
  assert.equal(priced.model, "claude-sonnet-5");
  assert.equal(priced.source, "env");
  assert.deepEqual(priced.usdPerMTok, resolveModelRoute("planner", {}).usdPerMTok);

  // A model with no row in the price table is unpriced — never guessed.
  const unpriced = resolveModelRoute("intake", { WFACT_ROUTE_INTAKE: "anthropic:claude-opus-5" });
  assert.equal(unpriced.usdPerMTok, null);
  assert.equal(estimateCostUsd(unpriced, { inputTokens: 1000, outputTokens: 1000 }), null);
});

test("costForModel: metered for priced models, UNPRICED (not $0) for Agent 37's builder", () => {
  const haiku = costForModel("claude-haiku-4-5", { inputTokens: 882, outputTokens: 167 });
  assert.equal(haiku.basis, "metered");
  assert.equal(haiku.costUsd, 0.001717); // the live Stage 4 intake call: 882 in / 167 out at $1/$5
  const agent37 = costForModel("hermes-agent", { inputTokens: 20_000, outputTokens: 3_000 });
  assert.equal(agent37.basis, "unpriced");
  assert.equal(agent37.costUsd, null);
  assert.equal(costForModel("never-heard-of-it", { inputTokens: 1, outputTokens: 1 }).basis, "unpriced");
});

test("a malformed override is refused", () => {
  assert.throws(() => resolveModelRoute("intake", { WFACT_ROUTE_INTAKE: "openai:gpt-x" }), RoutingError);
  assert.throws(() => resolveModelRoute("intake", { WFACT_ROUTE_INTAKE: "anthropic:" }), RoutingError);
});

test("an unconfigured slot is refused — there is no silent default model", () => {
  assert.throws(() => resolveModelRoute("research", {}), /no route configured/);
});

test("cost is computed from the configured price", () => {
  const route = resolveModelRoute("planner", {});
  const cost = estimateCostUsd(route, { inputTokens: 1_000_000, outputTokens: 100_000 });
  assert.equal(cost, route.usdPerMTok!.input + route.usdPerMTok!.output / 10);
});

test("a config with an unwired provider or missing price is rejected at load", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "routing-"));
  const bad = path.join(dir, "r.json");
  const models = { "claude-haiku-4-5": { provider: "anthropic", usdPerMTok: { input: 1, output: 5 } } };
  writeFileSync(bad, JSON.stringify({ version: "1", models, slots: { intake: { provider: "kimi", model: "k3", tier: "fast" } } }));
  assert.throws(() => loadRoutingTable(bad), /not wired/);
  writeFileSync(bad, JSON.stringify({ version: "1", models, slots: { intake: { provider: "anthropic", model: "claude-sonnet-5", tier: "fast" } } }));
  assert.throws(() => loadRoutingTable(bad), /no entry in "models"/);
  writeFileSync(bad, JSON.stringify({ version: "1", models: { "claude-haiku-4-5": { provider: "anthropic", usdPerMTok: { input: "1" } } }, slots: {} }));
  assert.throws(() => loadRoutingTable(bad), /must be \{input, output\}/);
});
