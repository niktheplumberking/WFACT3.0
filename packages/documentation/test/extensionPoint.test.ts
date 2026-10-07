import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { SEED_AGENT_DEFINITIONS, createSeedRegistry, validateScope } from "@wfact/agent-runtime";
import { DOCUMENTATION_AGENT_DEFINITION, DOCUMENTATION_ROLE, registerDocumentationAgent } from "../src/index.js";

const RUNTIME_SRC = path.join(import.meta.dirname, "..", "..", "agent-runtime", "src");

test("the Documentation agent needs no change to agent-runtime: no runtime source file names it", () => {
  const files = readdirSync(RUNTIME_SRC).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length >= 5, "agent-runtime sources found");
  for (const f of files) {
    const src = readFileSync(path.join(RUNTIME_SRC, f), "utf-8");
    assert.ok(!/documentation/i.test(src), `packages/agent-runtime/src/${f} mentions the documentation agent`);
  }
  assert.ok(!SEED_AGENT_DEFINITIONS.some((d) => d.role === DOCUMENTATION_ROLE), "not a seed role: it is registered at composition time");
});

test("it registers through the public registry API with a typed, minimal, default-deny scope", () => {
  const registry = createSeedRegistry();
  assert.equal(registry.has(DOCUMENTATION_ROLE), false);
  registerDocumentationAgent(registry);
  registerDocumentationAgent(registry); // idempotent
  assert.equal(registry.has(DOCUMENTATION_ROLE), true);
  const scope = registry.get(DOCUMENTATION_ROLE).permissionScope;
  validateScope(DOCUMENTATION_ROLE, scope);
  assert.deepEqual(scope.models, [], "no model slot");
  assert.equal(scope.maxCostUsdPerRun, 0, "no spend");
  assert.deepEqual(scope.tools, []);
  assert.deepEqual(scope.fsWrite, ["clients/{client}/memory.md"], "writes only the bound client's memory file");
  assert.deepEqual(scope.fsRead, ["clients/{client}/memory.md"]);
  assert.equal(scope.crossEntity, undefined);
  assert.deepEqual(scope.db, [
    { table: "audit_log", ops: ["select", "insert"] },
    { table: "model_traces", ops: ["select"] },
  ]);
  assert.deepEqual(DOCUMENTATION_AGENT_DEFINITION.modelSlots, []);
});
