import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { estimateCostUsd, loadRoutingTable, resolveModelRoute, RoutingError } from "../src/routing.js";

test("the shipped config routes intake to the fast tier and planner to the mid tier (Blueprint §5/§7)", () => {
  const intake = resolveModelRoute("intake", {});
  const planner = resolveModelRoute("planner", {});
  assert.equal(intake.tier, "fast");
  assert.equal(planner.tier, "mid");
  assert.notEqual(intake.model, planner.model, "the split is real, not one model for everything");
  assert.equal(intake.source, "config");
});

test("an env override swaps the model with no code change — and drops the price rather than guessing", () => {
  const route = resolveModelRoute("intake", { WFACT_ROUTE_INTAKE: "anthropic:claude-sonnet-5" });
  assert.equal(route.model, "claude-sonnet-5");
  assert.equal(route.source, "env");
  assert.equal(route.usdPerMTok, null);
  assert.equal(estimateCostUsd(route, { inputTokens: 1000, outputTokens: 1000 }), null);
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
  writeFileSync(bad, JSON.stringify({ version: "1", slots: { intake: { provider: "kimi", model: "k3", tier: "fast", usdPerMTok: { input: 1, output: 1 } } } }));
  assert.throws(() => loadRoutingTable(bad), /not wired/);
  writeFileSync(bad, JSON.stringify({ version: "1", slots: { intake: { provider: "anthropic", model: "claude-haiku-4-5", tier: "fast" } } }));
  assert.throws(() => loadRoutingTable(bad), /usdPerMTok/);
});
