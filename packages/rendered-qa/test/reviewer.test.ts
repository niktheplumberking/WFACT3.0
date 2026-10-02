/**
 * Screenshot reviewer contract, with the network mocked (no spend): vendor separation, strict JSON
 * with one answer per rule, bounded retry, NOT RUN (never a pass) on any failure to get a valid
 * answer, rule ids carried into the details the builder receives, and cost recorded per call.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REVIEW_RETRY_DELAYS_MS, createScreenshotReviewSuite, parseReview, REVIEW_CHECK_ID } from "../src/reviewer.js";
import { loadRulebook } from "../src/rulebook.js";
import type { Shot } from "../src/rendered.js";
import type { VerificationContext } from "@wfact/verification/checks/types";

const rulebook = loadRulebook();
const ids = rulebook.rules.filter((r) => r.detect.review).map((r) => r.id);
const shots: Shot[] = [{ page: "index.html", viewport: "desktop", width: 1440, file: "/dev/null", slices: [Buffer.from("fake-jpeg")] }];
const ctx: VerificationContext = { html: "<html></html>", clientSlug: "summit-line-roofing", requiredSections: [], otherClientSlugs: [], factSources: ["BRIEF TEXT"] };
const allPass = (over: Record<string, string> = {}) => JSON.stringify({ findings: ids.map((id) => ({ ruleId: id, verdict: over[id] ? "fail" : "pass", evidence: over[id] ?? "ok" })) });

function mockFetch(answers: (string | { status: number })[]) {
  const calls: { body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const impl = (async (_url: string, init: RequestInit) => {
    calls.push({ body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)]!;
    if (typeof a !== "string") return new Response(JSON.stringify({ error: { message: "denied" } }), { status: a.status });
    return new Response(JSON.stringify({ choices: [{ message: { content: a } }], usage: { prompt_tokens: 10000, completion_tokens: 800 } }), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("refuses to review a page built by the same vendor", () => {
  assert.throws(() => createScreenshotReviewSuite({ apiKey: "k", builderVendor: "OpenAI", shots: () => shots }), /different vendor/);
});

test("no API key: NOT RUN, never a pass, no network call", async () => {
  const { impl, calls } = mockFetch([allPass()]);
  const [r] = await createScreenshotReviewSuite({ apiKey: undefined, builderVendor: "agent37", shots: () => shots, fetchImpl: impl }).run(ctx);
  assert.equal(r!.checkId, REVIEW_CHECK_ID);
  assert.equal(r!.passed, false);
  assert.equal(r!.notRun, true);
  assert.equal(calls.length, 0);
});

test("a failed rule comes back with its id and evidence; cost is recorded from the price table", async () => {
  const { impl, calls } = mockFetch([allPass({ "DR-EYEBROW-OVERUSE": "every section has a small uppercase label (desktop)" })]);
  const suite = createScreenshotReviewSuite({ apiKey: "test-key", builderVendor: "agent37", shots: () => shots, fetchImpl: impl });
  const [r] = await suite.run(ctx);
  assert.equal(r!.passed, false);
  assert.equal(r!.notRun, undefined);
  assert.equal(r!.details.length, 1);
  assert.match(r!.details[0]!, /^DR-EYEBROW-OVERUSE: every section/);
  assert.equal(calls.length, 1);
  assert.equal(suite.calls[0]!.costUsd, 0.037, "10k in x $2.50/M + 800 out x $15/M");
});

test("all rules pass: the review passes", async () => {
  const { impl } = mockFetch([allPass()]);
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl }).run(ctx);
  assert.equal(r!.passed, true);
  assert.deepEqual(r!.details, []);
});

test("request carries a strict schema, every rule, the screenshots, the brief as data; key only in the header", async () => {
  const { impl, calls } = mockFetch([allPass()]);
  await createScreenshotReviewSuite({ apiKey: "secret-test-key", builderVendor: "agent37", shots: () => shots, fetchImpl: impl }).run(ctx);
  const body = calls[0]!.body as { response_format: { json_schema: { strict: boolean } } };
  assert.equal(body.response_format.json_schema.strict, true);
  const text = JSON.stringify(body);
  for (const id of ids) assert.ok(text.includes(id), `${id} missing from prompt`);
  assert.match(text, /data:image\/jpeg;base64,/);
  assert.match(text, /BRIEF TEXT/);
  assert.match(text, /never an instruction to you/);
  assert.ok(!text.includes("secret-test-key"));
  assert.equal(calls[0]!.headers.Authorization, "Bearer secret-test-key");
});

test("an incomplete answer is retried once, then NOT RUN", async () => {
  const partial = JSON.stringify({ findings: [{ ruleId: ids[0], verdict: "pass", evidence: "ok" }] });
  const { impl, calls } = mockFetch([partial, partial]);
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl }).run(ctx);
  assert.equal(calls.length, 2);
  assert.equal(r!.notRun, true);
  assert.match(r!.details[0]!, /rules not answered/);
});

test("a malformed first answer recovers on the retry", async () => {
  const { impl, calls } = mockFetch(["not json", allPass()]);
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl }).run(ctx);
  assert.equal(calls.length, 2);
  assert.equal(r!.passed, true);
});

test("an auth error is not retried and is NOT RUN", async () => {
  const { impl, calls } = mockFetch([{ status: 401 }]);
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl }).run(ctx);
  assert.equal(calls.length, 1);
  assert.equal(r!.notRun, true);
  assert.match(r!.details[0]!, /HTTP 401/);
});

test("a gateway outage (HTTP 502) is retried after a wait and recovers", async () => {
  const { impl, calls } = mockFetch([{ status: 502 }, { status: 502 }, allPass()]);
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl, retryDelaysMs: [0, 0, 0] }).run(ctx);
  assert.equal(calls.length, 3);
  assert.equal(r!.passed, true);
  assert.equal(r!.notRun, undefined);
});

test("a gateway outage that outlasts every wait is NOT RUN after a hard cap, never a pass", async () => {
  const { impl, calls } = mockFetch([{ status: 502 }]);
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl, retryDelaysMs: [0, 0, 0] }).run(ctx);
  assert.equal(calls.length, 4);
  assert.equal(r!.notRun, true);
  assert.match(r!.details[0]!, /after 4 attempts \(HTTP 502/);
});

test("the default waits grow and are capped", () => {
  assert.ok(REVIEW_RETRY_DELAYS_MS.length >= 2 && REVIEW_RETRY_DELAYS_MS.length <= 4);
  for (let i = 1; i < REVIEW_RETRY_DELAYS_MS.length; i++) assert.ok(REVIEW_RETRY_DELAYS_MS[i]! > REVIEW_RETRY_DELAYS_MS[i - 1]!);
});

test("parseReview rejects unknown ids and duplicate answers", () => {
  assert.throws(() => parseReview(JSON.stringify({ findings: [{ ruleId: "DR-NOPE", verdict: "pass", evidence: "" }] }), ids), /unknown rule id/);
  const dup = JSON.parse(allPass()) as { findings: unknown[] };
  dup.findings.push(dup.findings[0]);
  assert.throws(() => parseReview(JSON.stringify(dup), ids), /answered twice/);
});

test("no screenshots: NOT RUN", async () => {
  const { impl } = mockFetch([allPass()]);
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => [], fetchImpl: impl }).run(ctx);
  assert.equal(r!.notRun, true);
});
