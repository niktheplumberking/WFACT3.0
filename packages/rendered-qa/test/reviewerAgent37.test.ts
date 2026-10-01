/**
 * The Agent 37 reviewer path (Huraira, 2026-10-01), network mocked: a same-vendor review is refused
 * unless config/reviewer.json records the approval, is flagged when allowed, talks to the gateway, and
 * treats Agent 37's "HTTP 200 with an error as the content" as no answer (retried, then NOT RUN).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createScreenshotReviewSuite, loadReviewerDecision, type ReviewerDecision } from "../src/reviewer.js";
import { reviewerFromEnv } from "../src/index.js";
import { loadRulebook } from "../src/rulebook.js";
import type { Shot } from "../src/rendered.js";
import type { VerificationContext } from "@wfact/verification/checks/types";

const ids = loadRulebook().rules.filter((r) => r.detect.review).map((r) => r.id);
const shots: Shot[] = [{ page: "index.html", viewport: "phone", width: 375, file: "/dev/null", slices: [Buffer.from("x")] }];
const ctx: VerificationContext = { html: "<html></html>", clientSlug: "summit-line-roofing", requiredSections: [], otherClientSlugs: [], factSources: ["brief"] };
const answer = JSON.stringify({ findings: ids.map((id) => ({ ruleId: id, verdict: "pass", evidence: "ok" })) });
const decision = loadReviewerDecision();

function gateway(contents: { content: string; finish_reason?: string }[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const c = contents[Math.min(calls.length - 1, contents.length - 1)]!;
    return new Response(JSON.stringify({ choices: [{ message: { content: c.content }, finish_reason: c.finish_reason ?? "stop" }], usage: { prompt_tokens: 21000, completion_tokens: 900 } }), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("the committed decision record names Agent 37 and who approved the same-vendor review", () => {
  assert.equal(decision.provider, "agent37");
  assert.equal(decision.sameVendorAsBuilder?.vendor, "agent37");
  assert.equal(decision.sameVendorAsBuilder?.approvedBy, "Huraira");
  assert.match(decision.sameVendorAsBuilder?.on ?? "", /^\d{4}-\d{2}-\d{2}$/);
});

test("same vendor as the builder is refused without a recorded approval", () => {
  const noApproval: ReviewerDecision = { version: "x", provider: "agent37", model: "hermes-agent" };
  assert.throws(() => createScreenshotReviewSuite({ provider: "agent37", apiKey: "k", baseUrl: "https://gw.example", builderVendor: "agent37", shots: () => shots, decision: noApproval }), /same vendor as the builder/);
  assert.throws(() => createScreenshotReviewSuite({ provider: "agent37", apiKey: "k", baseUrl: "https://gw.example", builderVendor: "agent37", shots: () => shots }), /same vendor/);
});

test("with the approval: allowed, flagged, sent to the gateway without OpenAI-only fields, fenced JSON accepted", async () => {
  const { impl, calls } = gateway([{ content: "Here is my review:\n```json\n" + answer + "\n```" }]);
  const suite = createScreenshotReviewSuite({ provider: "agent37", apiKey: "k", baseUrl: "https://gw.example/v1/", builderVendor: "agent37", shots: () => shots, decision, fetchImpl: impl });
  assert.equal(suite.sameVendorAsBuilder, true);
  assert.match(suite.description, /SAME VENDOR AS BUILDER/);
  const [r] = await suite.run(ctx);
  assert.equal(r!.passed, true);
  assert.equal(calls[0]!.url, "https://gw.example/v1/chat/completions");
  assert.equal(calls[0]!.body.model, "hermes-agent");
  assert.equal(calls[0]!.body.response_format, undefined);
  assert.equal(suite.calls[0]!.costUsd, null, "Agent 37 has no price on file: UNPRICED, not $0");
});

test("a different-vendor builder needs no approval and is not flagged", () => {
  const suite = createScreenshotReviewSuite({ provider: "agent37", apiKey: "k", baseUrl: "https://gw.example", builderVendor: "claude", shots: () => shots });
  assert.equal(suite.sameVendorAsBuilder, false);
});

test("HTTP 200 with finish_reason error is not an answer: retried, then NOT RUN", async () => {
  const { impl, calls } = gateway([{ content: "upstream provider error", finish_reason: "error" }]);
  const [r] = await createScreenshotReviewSuite({ provider: "agent37", apiKey: "k", baseUrl: "https://gw.example", builderVendor: "agent37", shots: () => shots, decision, fetchImpl: impl }).run(ctx);
  assert.equal(calls.length, 2);
  assert.equal(r!.notRun, true);
});

test("reviewerFromEnv picks the gateway key and URL for Agent 37, and NOT RUN names the missing key", async () => {
  const setup = reviewerFromEnv({ AGENT37_API_KEY: "a", AGENT37_BASE_URL: "https://gw.example", OPENAI_API_KEY: "o" }, decision);
  assert.equal(setup.apiKey, "a");
  assert.equal(setup.baseUrl, "https://gw.example");
  const [r] = await createScreenshotReviewSuite({ ...reviewerFromEnv({}, decision), builderVendor: "agent37", shots: () => shots }).run(ctx);
  assert.equal(r!.notRun, true);
  assert.match(r!.details[0]!, /no AGENT37_API_KEY/);
});
