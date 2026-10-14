/**
 * Screenshot reviewer contract, with the network mocked (no spend): vendor separation, strict JSON
 * with one answer per rule, bounded retry, NOT RUN (never a pass) on any failure to get a valid
 * answer, rule ids carried into the details the builder receives, and cost recorded per call.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FAST_FAILURE_MS, REVIEW_RETRY_DELAYS_MS, REVIEW_REQUEST_TIMEOUT_MS, REVIEW_TOTAL_BUDGET_MS, createScreenshotReviewSuite, parseReview, REVIEW_CHECK_ID, reviewWorstCaseMs } from "../src/reviewer.js";
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

/**
 * A gateway that never answers: the call ends only when the caller's signal fires (what Agent 37 did on
 * 2026-10-13). `then[i]`, when set, answers call i+1 instead of hanging.
 */
function hungFetch(then: (string | { status: number } | null)[] = []) {
  const calls: number[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push(Date.now());
    const next = then[calls.length - 1];
    if (next != null) return mockFetch([next]).impl(url, init);
    // AbortSignal.timeout's timer is unref'd; a real hung socket keeps the process alive, so the mock holds a
    // timer of its own or Node ends the test run with "Promise resolution is still pending" (CI 38452956084).
    return new Promise<Response>((_resolve, reject) => {
      const keepAlive = setInterval(() => {}, 1_000);
      init.signal!.addEventListener("abort", () => { clearInterval(keepAlive); reject(init.signal!.reason); }, { once: true });
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("P0 defaults: one call is cut at 150 s and the whole review ends within 5 minutes", () => {
  assert.equal(REVIEW_REQUEST_TIMEOUT_MS, 150_000);
  assert.ok(REVIEW_TOTAL_BUDGET_MS <= 300_000, `review budget ${REVIEW_TOTAL_BUDGET_MS} ms`);
  // A hang gets one retry: two full calls fit the budget, so the retry is never cut short by design.
  assert.ok(2 * REVIEW_REQUEST_TIMEOUT_MS <= REVIEW_TOTAL_BUDGET_MS);
});

test("P0 item 2: the computed worst case of a whole review, every call and wait included, is under 6 minutes", () => {
  const worst = reviewWorstCaseMs();
  assert.ok(worst < 6 * 60_000, `worst case ${worst} ms`);
  assert.ok(REVIEW_REQUEST_TIMEOUT_MS <= 150_000, `per-call timeout ${REVIEW_REQUEST_TIMEOUT_MS} ms`);
  // Live direct Claude reviews take 30-65 s: a call is never cut before twice the slowest seen.
  assert.ok(REVIEW_REQUEST_TIMEOUT_MS >= 2 * 65_000);
  // Even with the per-call timeout raised to 150 s, the hard cap still bounds the review.
  assert.ok(reviewWorstCaseMs({ requestTimeoutMs: 150_000 }) < 6 * 60_000);
});

/** Node 22: AbortSignal.timeout timers are unref'd, so a mocked hang needs something keeping the loop alive (a9b271f). */
const keepAlive = () => {
  const t = setInterval(() => {}, 1_000);
  return () => clearInterval(t);
};

test("a SLOW 5xx (gateway sat on the request) is a hang: one retry, no backoff waits", async () => {
  const release = keepAlive();
  try {
    const calls: number[] = [];
    const impl = (async () => {
      calls.push(Date.now());
      await new Promise((r) => setTimeout(r, 40)); // 'slow' at test scale (FAST_FAILURE_MS is 20 s in production)
      return new Response(JSON.stringify({ error: { message: "upstream timeout" } }), { status: 504 });
    }) as unknown as typeof fetch;
    assert.equal(FAST_FAILURE_MS, 20_000, "production threshold; scaled to 20 ms below");
    const started = Date.now();
    const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl, retryDelaysMs: [5_000, 5_000, 5_000], fastFailureMs: 20, totalBudgetMs: 60_000 }).run(ctx);
    assert.equal(calls.length, 2, "one retry, as for a timeout");
    assert.ok(Date.now() - started < 1_000, "none of the 5 s backoff waits was taken");
    assert.equal(r!.notRun, true);
    assert.match(r!.details[0]!, /HTTP 504/);
    // A FAST 5xx still gets the backoff waits (a short outage).
    const fast = mockFetch([{ status: 502 }, allPass()]);
    const [ok] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: fast.impl, retryDelaysMs: [0, 0, 0], fastFailureMs: 20_000 }).run(ctx);
    assert.equal(ok!.passed, true);
  } finally {
    release();
  }
});

test("credits exhausted (402, Anthropic 400 credit balance, OpenAI insufficient_quota): one call, no retry, reason says 'credits exhausted'", async () => {
  for (const [status, message, provider] of [
    [402, "AI credits exhausted.", "agent37"],
    [400, "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.", "agent37"],
    [429, "You exceeded your current quota (insufficient_quota)", "agent37"],
  ] as const) {
    const calls: number[] = [];
    const impl = (async () => {
      calls.push(1);
      return new Response(JSON.stringify({ error: { message } }), { status });
    }) as unknown as typeof fetch;
    const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "anthropic", provider, baseUrl: "https://gw.test", shots: () => shots, fetchImpl: impl, retryDelaysMs: [0, 0, 0] }).run(ctx);
    assert.equal(calls.length, 1, `HTTP ${status} must not be retried`);
    assert.equal(r!.notRun, true);
    assert.match(r!.details[0]!, /credits exhausted/);
  }
});

test("a hung call is no answer: retried once straight away (no backoff), then NOT RUN", async () => {
  const { impl, calls } = hungFetch();
  const started = Date.now();
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl, retryDelaysMs: [5_000, 5_000, 5_000], requestTimeoutMs: 60, totalBudgetMs: 5_000 }).run(ctx);
  assert.equal(calls.length, 2, "one retry after a timeout, not four");
  assert.ok(Date.now() - started < 1_000, "the 5 s transport waits were not used for a timeout");
  assert.equal(r!.notRun, true);
  assert.equal(r!.passed, false);
  assert.match(r!.details[0]!, /after 2 attempts \(no answer within 0 s\)/);
});

test("a hang then a good answer: the retry passes", async () => {
  const { impl, calls } = hungFetch([null, allPass()]);
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl, requestTimeoutMs: 60, totalBudgetMs: 5_000 }).run(ctx);
  assert.equal(calls.length, 2);
  assert.equal(r!.passed, true);
});

test("the review time budget is a hard ceiling: a wait that would end past it is not taken", async () => {
  const { impl, calls } = mockFetch([{ status: 502 }]);
  const started = Date.now();
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl, retryDelaysMs: [50, 100, 400], totalBudgetMs: 300 }).run(ctx);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 300, `ended in ${elapsed} ms, inside the 300 ms budget`);
  assert.equal(calls.length, 3, "502, wait 50, 502, wait 100, 502, then the 400 ms wait would pass the deadline");
  assert.equal(r!.notRun, true);
  assert.match(r!.details[0]!, /HTTP 502.*review time budget used up/);
});

test("worst case, scaled: hangs and outages mixed never run past the budget", async () => {
  // The defaults' shape (call 150 s, waits 15/45/120 s, budget 300 s) at 1/1000 scale: two fast 502s, then hangs.
  const { impl, calls } = hungFetch([{ status: 502 }, { status: 502 }]);
  const started = Date.now();
  const [r] = await createScreenshotReviewSuite({ apiKey: "k", builderVendor: "agent37", shots: () => shots, fetchImpl: impl, retryDelaysMs: [15, 45, 120], requestTimeoutMs: 150, totalBudgetMs: 300 }).run(ctx);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 300 + 50, `ended in ${elapsed} ms against a 300 ms budget`);
  assert.ok(calls.length >= 3);
  assert.equal(r!.notRun, true);
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
