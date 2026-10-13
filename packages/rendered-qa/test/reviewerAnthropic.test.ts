/**
 * The Anthropic reviewer (reviewer.json 1.1.0, Huraira 2026-10-13) and the long-call fetch, network mocked
 * except for one local HTTP server. Every Agent 37 review was cut at Node's 5-minute fetch header limit
 * (UND_ERR_HEADERS_TIMEOUT); these tests pin the request shape, the answer mapping, and that the fetch's
 * own limits follow the caller's timeout instead of Node's 300 s default.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createScreenshotReviewSuite, loadReviewerDecision, normalizeAnswer, REVIEW_REQUEST_TIMEOUT_MS } from "../src/reviewer.js";
import { reviewerFromEnv } from "../src/index.js";
import { DISPATCHER_HEADROOM_MS, fetchWithTimeout } from "../src/longFetch.js";
import { EXTRA_PAGE_SLICES, VIEWPORTS } from "../src/rendered.js";
import { loadRulebook } from "../src/rulebook.js";
import type { Shot } from "../src/rendered.js";
import type { VerificationContext } from "@wfact/verification/checks/types";

const ids = loadRulebook().rules.filter((r) => r.detect.review).map((r) => r.id);
const shots: Shot[] = [{ page: "index.html", viewport: "desktop", width: 1440, file: "/dev/null", slices: [Buffer.from("jpeg-bytes")] }];
const ctx: VerificationContext = { html: "<html></html>", clientSlug: "lanternworks-studio", requiredSections: [], otherClientSlugs: [], factSources: ["brief"] };
const answer = JSON.stringify({ findings: ids.map((id) => ({ ruleId: id, verdict: "pass", evidence: "ok" })) });
const decision = loadReviewerDecision();

function messagesApi(replies: { text?: string; stop_reason?: string; status?: number }[]) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)]!;
    const json = r.status && r.status >= 400
      ? { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }
      : { content: [{ type: "text", text: r.text ?? answer }], stop_reason: r.stop_reason ?? "end_turn", usage: { input_tokens: 20000, output_tokens: 1000 } };
    return new Response(JSON.stringify(json), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("the committed decision record is Anthropic claude-sonnet-5, version 1.1.0, approved by Huraira", () => {
  assert.equal(decision.provider, "anthropic");
  assert.equal(decision.model, "claude-sonnet-5");
  assert.equal(decision.version, "1.1.0");
  const setup = reviewerFromEnv({ ANTHROPIC_API_KEY: "sk-test", AGENT37_API_KEY: "a", OPENAI_API_KEY: "o" }, decision);
  assert.deepEqual([setup.provider, setup.model, setup.apiKey], ["anthropic", "claude-sonnet-5", "sk-test"]);
});

test("a different vendor from the Agent 37 builder: allowed with no same-vendor approval, and not flagged", () => {
  const suite = createScreenshotReviewSuite({ ...reviewerFromEnv({ ANTHROPIC_API_KEY: "k" }, decision), builderVendor: "agent37", shots: () => shots });
  assert.equal(suite.sameVendorAsBuilder, false);
  assert.doesNotMatch(suite.description, /SAME VENDOR/);
});

test("request shape: Messages API URL and headers, top-level system, base64 image blocks, JSON schema output", async () => {
  const { impl, calls } = messagesApi([{}]);
  const suite = createScreenshotReviewSuite({ provider: "anthropic", model: "claude-sonnet-5", apiKey: "sk-test", builderVendor: "agent37", shots: () => shots, decision, fetchImpl: impl });
  const [r] = await suite.run(ctx);
  assert.equal(r!.passed, true, r!.details.join("; "));
  const c = calls[0]!;
  assert.equal(c.url, "https://api.anthropic.com/v1/messages");
  assert.equal(c.headers["x-api-key"], "sk-test");
  assert.equal(c.headers["anthropic-version"], "2023-06-01");
  assert.equal(c.headers.Authorization, undefined);
  assert.equal(c.body.model, "claude-sonnet-5");
  assert.equal(c.body.max_tokens, 16_000);
  assert.match(String(c.body.system), /independent visual design reviewer/);
  const content = (c.body.messages as { role: string; content: { type: string; source?: { type: string; media_type: string; data: string } }[] }[])[0]!.content;
  const image = content.find((b) => b.type === "image")!;
  assert.deepEqual(image.source, { type: "base64", media_type: "image/jpeg", data: Buffer.from("jpeg-bytes").toString("base64") });
  assert.ok(!content.some((b) => b.type === "image_url"), "no OpenAI-style image blocks");
  assert.equal((c.body.output_config as { format: { type: string } }).format.type, "json_schema");
  assert.equal(c.body.response_format, undefined);
  // Priced from model-routing.json (claude-sonnet-5 $2/$10 per MTok): 20,000 in / 1,000 out.
  assert.equal(suite.calls[0]!.costUsd, 0.05);
});

test("a cut-off answer (stop_reason max_tokens) is no answer: retried once, then NOT RUN, never a pass", async () => {
  const { impl, calls } = messagesApi([{ text: '{"findings":[', stop_reason: "max_tokens" }]);
  const traced: { outcome: string; error: string | null }[] = [];
  const suite = createScreenshotReviewSuite({ provider: "anthropic", apiKey: "k", builderVendor: "agent37", shots: () => shots, decision, fetchImpl: impl, onCall: async (c) => { traced.push(c); } });
  const [r] = await suite.run(ctx);
  assert.equal(r!.passed, false);
  assert.equal(r!.notRun, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(traced.map((t) => t.outcome), ["error", "error"], "a paid call with no usable answer is traced as an error");
});

test("HTTP 529 overloaded is a transient failure: waited and retried, then answered", async () => {
  const { impl, calls } = messagesApi([{ status: 529 }, {}]);
  const suite = createScreenshotReviewSuite({ provider: "anthropic", apiKey: "k", builderVendor: "agent37", shots: () => shots, decision, fetchImpl: impl, retryDelaysMs: [0, 0, 0] });
  const [r] = await suite.run(ctx);
  assert.equal(r!.passed, true);
  assert.equal(calls.length, 2);
});

test("normalizeAnswer maps usage and errors; other providers pass through unchanged", () => {
  const n = normalizeAnswer("anthropic", { content: [{ type: "text", text: "x" }], stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 7 } });
  assert.deepEqual(n.usage, { prompt_tokens: 5, completion_tokens: 7 });
  assert.equal(n.choices![0]!.message!.content, "x");
  assert.equal(normalizeAnswer("anthropic", { content: [{ type: "text", text: "no" }], stop_reason: "refusal" }).choices![0]!.finish_reason, "error");
  assert.deepEqual(normalizeAnswer("anthropic", { type: "error", error: { message: "bad key" } }).error, { message: "bad key" });
  const chat = { choices: [{ message: { content: "y" } }] };
  assert.equal(normalizeAnswer("agent37", chat), chat);
});

async function slowServer(delayMs: number) {
  const srv = http.createServer((_req, res) => {
    setTimeout(() => res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}'), delayMs);
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}/`, close: () => new Promise((r) => srv.close(r)) };
}

test("fetchWithTimeout: the header limit follows the caller's timeout plus headroom, not Node's fixed 300 s", async () => {
  // P0 (2026-10-13): a review call is cut at 120 s by its own signal, inside Node's 300 s default; the dispatcher
  // limit only has to sit above that signal so the caller's message is the one reported.
  assert.ok(DISPATCHER_HEADROOM_MS > 0, "the caller's signal fires before the dispatcher limit");
  assert.ok(REVIEW_REQUEST_TIMEOUT_MS < 300_000, "a review call ends inside Node's default limit as well");
  const s = await slowServer(3000);
  try {
    // Limit 1 s (undici checks timeouts on a coarse tick): headers arrive at 3 s, so the dispatcher gives up (the same failure Node gave at 300 s).
    await assert.rejects(fetchWithTimeout(1000 - DISPATCHER_HEADROOM_MS)(s.url, { method: "POST", body: "{}" }), (e: Error & { cause?: { code?: string } }) => e.cause?.code === "UND_ERR_HEADERS_TIMEOUT");
    // Limit 8 s: the same slow answer is received.
    const res = await fetchWithTimeout(8000 - DISPATCHER_HEADROOM_MS)(s.url, { method: "POST", body: "{}" });
    assert.deepEqual(await res.json(), { ok: true });
  } finally {
    await s.close();
  }
});

test("review payload: 7 slices on the first page, 2 per extra page (a five-page site sends at most 15 images)", () => {
  const first = VIEWPORTS.reduce((n, v) => n + v.slices, 0);
  const extra = VIEWPORTS.reduce((n, v) => n + Math.min(v.slices, EXTRA_PAGE_SLICES[v.name]), 0);
  assert.equal(first, 7);
  assert.equal(extra, 2);
  assert.ok(first + 4 * extra <= 15);
});
