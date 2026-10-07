/**
 * Step 7 task 5: cross-model separation enforced by configuration (config/evaluator.json), and the
 * second-vendor evaluator adapter (OpenAI, over fetch). No network: the OpenAI adapter runs against an
 * injected fetch that records the request and answers like the API.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CrossModelViolationError, assertCrossModelSeparation, familyOf, identityFromVendor, loadEvaluatorConfig, modelIdentity, type EvaluatorConfig,
} from "../src/crossModel.js";
import { ClaudeModelClient, MockModelClient, OpenAIModelClient, evaluatorModelClientFromEnv } from "../src/modelClient.js";

const config = loadEvaluatorConfig();

test("families come from config: Claude models are one family, GPT another, Agent 37 its own", () => {
  assert.equal(familyOf({ vendor: "anthropic", model: "claude-sonnet-5" }), "anthropic-claude");
  assert.equal(familyOf({ vendor: "anthropic", model: "claude-haiku-4-5" }), "anthropic-claude");
  assert.equal(familyOf({ vendor: "openai", model: "gpt-5.4" }), "openai-gpt");
  assert.equal(familyOf({ vendor: "agent37", model: "hermes-agent" }), "agent37-hermes");
  assert.match(config.version, /^\d+\.\d+\.\d+$/);
});

test("today's pairing passes: Agent 37 builder, Claude evaluator", () => {
  const s = assertCrossModelSeparation({ vendor: "agent37", model: "hermes-agent" }, { vendor: "anthropic", model: "claude-sonnet-5" });
  assert.equal(s.builder.family, "agent37-hermes");
  assert.equal(s.evaluator!.family, "anthropic-claude");
});

test("fails LOUDLY when builder and evaluator resolve to the same family, even with different model ids", () => {
  assert.throws(
    () => assertCrossModelSeparation({ vendor: "anthropic", model: "claude-sonnet-5" }, { vendor: "anthropic", model: "claude-haiku-4-5" }),
    (err: unknown) => err instanceof CrossModelViolationError && /both "anthropic-claude" models/.test(err.message),
  );
  assert.throws(() => assertCrossModelSeparation({ vendor: "openai", model: "gpt-5.4" }, { vendor: "openai", model: "o3" }), CrossModelViolationError);
});

test("the same instance is always refused, and an unknown model is refused (fail closed)", () => {
  assert.throws(() => assertCrossModelSeparation({ vendor: "agent37", model: "hermes-agent" }, { vendor: "anthropic", model: "claude-sonnet-5" }, { sameInstance: true }), /builder's own model instance/);
  assert.throws(() => familyOf({ vendor: "kimi", model: "k3" }), /matches no model family/);
  assert.throws(() => assertCrossModelSeparation({ vendor: "kimi", model: "k3" }, { vendor: "anthropic", model: "claude-sonnet-5" }), CrossModelViolationError);
});

test("no evaluator is allowed at composition (the run can never be approved without one)", () => {
  assert.equal(assertCrossModelSeparation({ vendor: "agent37", model: "hermes-agent" }, null).evaluator, null);
});

test("modelIdentity reads real clients, and refuses a client it cannot identify", () => {
  assert.deepEqual(modelIdentity(new ClaudeModelClient("sk-ant-test-not-real", "claude-sonnet-5")), { vendor: "anthropic", model: "claude-sonnet-5" });
  assert.deepEqual(modelIdentity(new OpenAIModelClient("test-key-not-real", "gpt-5.4")), { vendor: "openai", model: "gpt-5.4" });
  assert.deepEqual(modelIdentity({ name: "agent37" }), { vendor: "agent37", model: "hermes-agent" });
  assert.deepEqual(modelIdentity({ name: "claude:claude-haiku-4-5" }), { vendor: "anthropic", model: "claude-haiku-4-5" });
  assert.equal(familyOf(modelIdentity(new MockModelClient(() => "", "fam-a"))), "fam-a");
  assert.throws(() => modelIdentity({ name: "mystery" }), CrossModelViolationError);
  assert.deepEqual(identityFromVendor("claude"), { vendor: "anthropic", model: "claude-sonnet-5" });
});

test("evaluator selection: Claude by default; a Claude builder gets the second vendor; no key = null with the reason (names only)", () => {
  const both = { ANTHROPIC_API_KEY: "a-test", OPENAI_API_KEY: "o-test" } as NodeJS.ProcessEnv;
  assert.equal(evaluatorModelClientFromEnv(both).client!.name, "claude");
  assert.equal(evaluatorModelClientFromEnv(both, { avoid: { vendor: "agent37", model: "hermes-agent" } }).client!.name, "claude");
  const forClaudeBuilder = evaluatorModelClientFromEnv(both, { avoid: { vendor: "anthropic", model: "claude-sonnet-5" } });
  assert.equal(forClaudeBuilder.client!.name, "openai");
  assert.equal((forClaudeBuilder.client as OpenAIModelClient).modelIdUsed, "gpt-5.4");

  const onlyClaude = evaluatorModelClientFromEnv({ ANTHROPIC_API_KEY: "a-test" } as NodeJS.ProcessEnv, { avoid: { vendor: "anthropic", model: "claude-sonnet-5" } });
  assert.equal(onlyClaude.client, null, "never falls back to a same-family evaluator");
  assert.match(onlyClaude.reason!, /same family as the builder/);
  assert.match(onlyClaude.reason!, /OPENAI_API_KEY is not set/);
  assert.ok(!onlyClaude.reason!.includes("a-test"), "a key value never appears in a reason");

  assert.equal(evaluatorModelClientFromEnv({} as NodeJS.ProcessEnv).client, null);
  // ANTHROPIC_MODEL still overrides the default Claude model, as before Step 7.
  assert.equal((evaluatorModelClientFromEnv({ ANTHROPIC_API_KEY: "a", ANTHROPIC_MODEL: "claude-haiku-4-5" } as NodeJS.ProcessEnv).client as ClaudeModelClient).modelIdUsed, "claude-haiku-4-5");
});

test("a config whose candidates are all the builder's family yields no evaluator rather than a same-family one", () => {
  const onlyClaude: EvaluatorConfig = { ...config, candidates: config.candidates.filter((c) => c.provider === "anthropic") };
  const r = evaluatorModelClientFromEnv({ ANTHROPIC_API_KEY: "x" } as NodeJS.ProcessEnv, { avoid: { vendor: "anthropic", model: "claude-opus-5" }, config: onlyClaude });
  assert.equal(r.client, null);
});

// --- OpenAI adapter (mocked HTTP) ---------------------------------------------------------------------

function fakeFetch(respond: (body: Record<string, unknown>) => { status: number; json?: unknown; text?: string }) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ url: String(url), headers: init?.headers as Record<string, string>, body });
    const r = respond(body);
    return new Response(r.json !== undefined ? JSON.stringify(r.json) : (r.text ?? ""), { status: r.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}

test("OpenAI adapter: sends system + user, key only in the Authorization header, returns the text, accumulates usage", async () => {
  const f = fakeFetch(() => ({ status: 200, json: { choices: [{ message: { content: "VERDICT: APPROVED" }, finish_reason: "stop" }], usage: { prompt_tokens: 1200, completion_tokens: 40 } } }));
  const c = new OpenAIModelClient("test-key-not-real", "gpt-5.4", "https://api.openai.test/v1", f.impl);
  assert.equal(await c.complete({ system: "RUBRIC", user: "PAGE" }), "VERDICT: APPROVED");
  assert.equal(f.calls[0]!.url, "https://api.openai.test/v1/chat/completions");
  assert.equal(f.calls[0]!.headers.Authorization, "Bearer test-key-not-real");
  assert.deepEqual(f.calls[0]!.body.messages, [{ role: "system", content: "RUBRIC" }, { role: "user", content: "PAGE" }]);
  assert.equal(f.calls[0]!.body.model, "gpt-5.4");
  assert.ok(!JSON.stringify(f.calls[0]!.body).includes("test-key-not-real"));
  assert.deepEqual(c.totalUsage, { inputTokens: 1200, outputTokens: 40 });
});

test("OpenAI adapter: HTTP errors (e.g. 429 no credits), truncation and empty answers throw; never an approval", async () => {
  const noCredit = new OpenAIModelClient("k", "gpt-5.4", undefined, fakeFetch(() => ({ status: 429, text: '{"error":{"message":"You exceeded your current quota"}}' })).impl);
  await assert.rejects(noCredit.complete({ system: "s", user: "u" }), /HTTP 429/);
  const cut = new OpenAIModelClient("k", "gpt-5.4", undefined, fakeFetch(() => ({ status: 200, json: { choices: [{ message: { content: "VERDICT: APP" }, finish_reason: "length" }] } })).impl);
  await assert.rejects(cut.complete({ system: "s", user: "u" }), /truncated/);
  const empty = new OpenAIModelClient("k", "gpt-5.4", undefined, fakeFetch(() => ({ status: 200, json: { choices: [{ message: { content: null }, finish_reason: "stop" }] } })).impl);
  await assert.rejects(empty.complete({ system: "s", user: "u" }), /no text/);
});
