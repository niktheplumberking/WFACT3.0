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
// The Agent 37 decision as it stood in reviewer.json 1.0.0 (2026-10-01); the committed record moved to Anthropic in 1.1.0.
const decision: ReviewerDecision = {
  version: "1.0.0",
  provider: "agent37",
  model: "hermes-agent",
  sameVendorAsBuilder: { vendor: "agent37", approvedBy: "Huraira", on: "2026-10-01", why: "OpenAI has no credits" },
};

function gateway(contents: { content: string; finish_reason?: string }[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const c = contents[Math.min(calls.length - 1, contents.length - 1)]!;
    return new Response(JSON.stringify({ choices: [{ message: { content: c.content }, finish_reason: c.finish_reason ?? "stop" }], usage: { prompt_tokens: 21000, completion_tokens: 900 } }), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("an Agent 37 decision record must name who approved the same-vendor review", () => {
  assert.equal(decision.sameVendorAsBuilder?.vendor, "agent37");
  assert.equal(decision.sameVendorAsBuilder?.approvedBy, "Huraira");
  assert.match(decision.sameVendorAsBuilder?.on ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(loadReviewerDecision().provider, "agent37", "the committed reviewer is no longer Agent 37 (1.1.0)");
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
  // MVP M6: Agent 37 is priced at the $3/$15 estimate (model-routing.json 1.4.0): 21,000 in / 900 out.
  assert.equal(suite.calls[0]!.costUsd, 0.0765);
});

test("MVP M6: every reviewer call is reported to onCall (errors too), and beforeCall can refuse the call", async () => {
  const { impl, calls } = gateway([{ content: "upstream broke", finish_reason: "error" }, { content: answer }]);
  const seen: { outcome: string; inputTokens: number; error: string | null }[] = [];
  let checks = 0;
  const suite = createScreenshotReviewSuite({
    provider: "agent37", apiKey: "k", baseUrl: "https://gw.example", builderVendor: "agent37", shots: () => shots, decision, fetchImpl: impl,
    beforeCall: async () => { checks++; },
    onCall: async (c) => { seen.push({ outcome: c.outcome, inputTokens: c.inputTokens, error: c.error }); },
  });
  const [r] = await suite.run(ctx);
  assert.equal(r!.passed, true);
  assert.equal(checks, 2);
  assert.equal(seen.length, 2, "both paid calls recorded, including the one whose answer was unusable");
  assert.equal(seen[0]!.inputTokens, 21000);

  const refused = createScreenshotReviewSuite({
    provider: "agent37", apiKey: "k", baseUrl: "https://gw.example", builderVendor: "agent37", shots: () => shots, decision, fetchImpl: impl,
    beforeCall: async () => { throw new Error("Spend cap reached"); },
  });
  const before = calls.length;
  await assert.rejects(refused.run(ctx), /Spend cap reached/);
  assert.equal(calls.length, before, "no request sent once the cap refuses");
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
