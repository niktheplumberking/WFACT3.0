import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolRegistry } from "../src/tools/registry.js";
import { HermesLite, detectEntitySlug } from "../src/controller.js";
import { MockModelClient } from "../src/modelClient.js";
import type { ProjectStatusRow, StateReader } from "../src/state.js";

class FakeStateReader implements StateReader {
  constructor(private readonly rows: Record<string, ProjectStatusRow[]>) {}
  async getProjectStatuses(entitySlug: string): Promise<ProjectStatusRow[]> {
    return this.rows[entitySlug] ?? [];
  }
}

const fakeRows: Record<string, ProjectStatusRow[]> = {
  dreamsign: [
    {
      entitySlug: "dreamsign",
      clientName: "DreamSign Client",
      projectName: "DreamSign Website",
      stage: "0_onboarding",
      status: "active",
      updatedAt: "2026-09-08T00:00:00Z",
    },
  ],
};

test("detectEntitySlug matches known aliases, including 'Bennett & Co'", () => {
  assert.equal(detectEntitySlug("what stage is DreamSign in?"), "dreamsign");
  assert.equal(detectEntitySlug("status update for Bennett & Co please"), "bennett-co");
  assert.equal(detectEntitySlug("how's the sprint going"), null);
});

test("end-to-end: memory + live state get assembled and handed to the model, sourced not guessed", async () => {
  const registry = buildToolRegistry(new FakeStateReader(fakeRows));
  const model = new MockModelClient(() => "DreamSign is at onboarding stage, waiting on a brief.");
  const hermes = new HermesLite({ toolRegistry: registry, modelClient: model });

  const result = await hermes.answerStatusQuestion("what stage is DreamSign in?");

  assert.equal(result.needsHuman, false);
  assert.equal(result.entitySlug, "dreamsign");
  assert.ok(result.sourcesUsed.includes("memory/context.md"));
  assert.ok(result.sourcesUsed.includes("supabase:projects(entity=dreamsign)"));
  assert.equal(model.calls.length, 1);
  // The model must have actually received the live state row, not just the question.
  assert.match(model.calls[0]!.user, /0_onboarding/);
  assert.match(model.calls[0]!.user, /DreamSign Website/);
});

test("a question with no matching entity still answers from business-wide memory alone", async () => {
  const registry = buildToolRegistry(new FakeStateReader(fakeRows));
  const model = new MockModelClient(() => "Not sure which client you mean.");
  const hermes = new HermesLite({ toolRegistry: registry, modelClient: model });

  const result = await hermes.answerStatusQuestion("how many entities do we have?");

  assert.equal(result.entitySlug, null);
  assert.deepEqual(result.sourcesUsed, ["memory/context.md"]);
});

test("model failure escalates to a human instead of returning a fabricated answer", async () => {
  const registry = buildToolRegistry(new FakeStateReader(fakeRows));
  const model = new MockModelClient(() => {
    throw new Error("simulated model outage");
  });
  const hermes = new HermesLite({
    toolRegistry: registry,
    modelClient: model,
    retry: { maxAttempts: 2, baseDelayMs: 1 },
  });

  const result = await hermes.answerStatusQuestion("what stage is DreamSign in?");

  assert.equal(result.needsHuman, true);
  assert.equal(result.answer, "");
  assert.match(result.escalationReason ?? "", /simulated model outage/);
});

test("without a state reader configured, still answers from memory, notes state is unavailable", async () => {
  const registry = buildToolRegistry(null);
  const model = new MockModelClient(() => "Here's what memory says.");
  const hermes = new HermesLite({ toolRegistry: registry, modelClient: model });

  const result = await hermes.answerStatusQuestion("what stage is DreamSign in?");

  assert.equal(result.needsHuman, false);
  assert.ok(!result.sourcesUsed.some((s) => s.startsWith("supabase:")));
  assert.match(model.calls[0]!.user, /state layer not configured/);
});

test("model output runs through the tone filter before it reaches the caller", async () => {
  const registry = buildToolRegistry(null);
  const model = new MockModelClient(() => "We fixed the RLS schema after a migration.");
  const hermes = new HermesLite({ toolRegistry: registry, modelClient: model });

  const result = await hermes.answerStatusQuestion("what happened with the database?");

  assert.doesNotMatch(result.answer, /\bRLS\b/);
  assert.ok(result.toneFilter.replacedTerms.length > 0);
});
