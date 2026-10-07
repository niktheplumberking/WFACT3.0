import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));
import { carryOnRequest, detectNeeds, diagnoseJob, reportText, savedState, unansweredNeeds } from "./recovery";
import type { JobRow } from "../jobsClient";

const PLAN = "22222222-2222-4222-8222-222222222222";
const RUN = "66666666-6666-4666-8666-666666666666";
let n = 0;
const job = (over: Partial<JobRow> & { result?: Record<string, unknown> | null } = {}): JobRow => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  created_at: new Date(Date.UTC(2026, 9, 7, 10, n)).toISOString(),
  kind: "build_plan",
  params: { planId: PLAN },
  status: "failed",
  started_at: null,
  finished_at: null,
  result: null,
  error: null,
  gh_run_url: null,
  archived_at: null,
  ...over,
});
const halted = (status: string, error: string, extra: Record<string, unknown> = {}) =>
  job({ error, result: { status, planId: PLAN, workflowRunId: RUN, qaIssues: [], ...extra } });

describe("why a build stopped, in the owner's terms", () => {
  it.each([
    ["money: credits exhausted", halted("build_failed", 'builder escalated: Agent 37 reported failure: HTTP 402: {"error":"AI credits exhausted."}'), "money"],
    ["money: provider quota", halted("qa_failed", "qa-evaluator escalated: OpenAI evaluator request failed: insufficient_quota"), "money"],
    ["money beats a reviewer outage that was really 402", halted("not_verified_no_evaluator", "deterministic checks passed but a required review could not run (render.design-review: NOT RUN: HTTP 402)"), "money"],
    ["setup: the build's own spending limit", halted("build_failed", 'builder escalated: permission denied for role "front-end-builder": spend:$1.02 (this run has spent $1.02, at or over the role\'s ceiling of $1)'), "setup"],
    ["setup: dispatcher token", job({ error: "Dispatcher not configured: GITHUB_DISPATCH_TOKEN is not set" }), "setup"],
    ["setup: missing key", job({ error: "Error: builder models unavailable: Neither AGENT37_BASE_URL nor ANTHROPIC_API_KEY is set" }), "setup"],
    ["setup: no Track B builder", job({ error: "plan x is Track B, but this runner has no Track B builder configured; it is not built as Track A" }), "setup"],
    ["temporary: the model service never answered", halted("build_failed", "builder escalated: Escalating to a human after 1 attempt(s): Agent 37 request failed: no response (fetch failed) (after 4 attempts; gateway unavailable, escalating)"), "temporary"],
    ["temporary: the reviewer was down", halted("not_verified_no_evaluator", "deterministic checks passed but a required review could not run (render.design-review: NOT RUN: HTTP 502: upstream_unreachable)"), "temporary"],
    ["temporary: the worker crashed", job({ error: "runner crashed before recording a result — see https://github.com/x/actions/runs/1" }), "temporary"],
    ["temporary: an exception inside a started run", job({ error: "AuditWriteError: audit_log write failed", result: { status: "crashed", workflowRunId: RUN, progress: { saved: "built" } } }), "temporary"],
    ["temporary: saved site no longer matches", halted("checkpoint_corrupt", "checkpointed artifact x no longer matches its checkpoint hash — refusing to verify a changed file"), "temporary"],
    ["fixable: failed its checks after revisions", halted("failed_verification", "QA still failing after 2 revision(s) — escalating to a human rather than retrying forever", { qaIssues: ["[render.layout] overflow on 375px"] }), "fixable"],
    ["fixable: reviewer kept asking for changes", halted("build_failed", "builder escalated: Hit the 3-round cap without reviewer approval; escalating per CLAUDE.md §6."), "fixable"],
    ["factory: a scope contradiction", halted("build_failed", 'builder rejected: permission denied for role "front-end-builder": client:x (client x belongs to entity "a")'), "factory"],
    ["factory: the isolated build", halted("build_failed", "builder escalated: The isolated Track B build failed: next build failed (exit 1)"), "factory"],
    ["factory: an invalid brief", job({ error: 'InvalidBriefError: Brief is missing required string field "goal".' }), "factory"],
    ["unknown: something never seen", job({ error: "Error: something nobody planned for" }), "unknown"],
  ])("%s", (_name, j, cause) => {
    expect(diagnoseJob(j, [j], { planId: PLAN }).cause).toBe(cause);
  });
});

describe("what is missing, named from the failed checks", () => {
  it("an invented phone number and hours become two plain fields; the client's own words are never guessed", () => {
    const j = halted("failed_verification", "QA still failing", {
      qaIssues: ["[claims.unsourced-fact] phone number 0400 111 222 on contact.html is not in the brief", "[claims.unsourced-fact] opening hours Mon to Fri on index.html have no source"],
    });
    const needs = detectNeeds(j);
    expect(needs.map((x) => x.key)).toEqual(["phone", "hours"]);
    expect(diagnoseJob(j, [j], { planId: PLAN }).cause).toBe("info");
  });

  it("a required testimonials section with no quotes asks for real customer quotes", () => {
    const j = halted("build_failed", "builder escalated: The builder's content was still invalid after 3 attempts: the brief requires a section with id testimonials (customer words)", {});
    expect(detectNeeds(j).map((x) => x.key)).toEqual(["quotes"]);
  });

  it("the evaluator's 'NEEDS CLIENT INPUT' notes become questions", () => {
    const j = job({ status: "succeeded", result: { status: "awaiting_launch_approval", needsFromClient: ["The opening date", "Which suburbs you serve"] } });
    const needs = detectNeeds(j);
    expect(needs).toHaveLength(2);
    expect(needs[0]).toMatchObject({ label: "The opening date", kind: "answer" });
  });

  it("an answered or skipped need is not asked again", () => {
    const needs = detectNeeds(halted("failed_verification", "x", { qaIssues: ["[claims.unsourced-fact] phone number 0400 not in the brief", "[claims.unsourced-fact] email a@b.test not in the brief"] }));
    const rows = [
      { id: "1", created_at: "x", plan_id: PLAN, kind: "fact" as const, key: "phone", label: "Phone", value: "0400 111 222", waived: false },
      { id: "2", created_at: "x", plan_id: PLAN, kind: "fact" as const, key: "email", label: "Email", value: null, waived: true },
    ];
    expect(unansweredNeeds(needs, rows)).toEqual([]);
    expect(unansweredNeeds(needs, rows.slice(0, 1)).map((n) => n.key)).toEqual(["email"]);
  });

  it("nothing is invented when the failure names nothing", () => {
    expect(detectNeeds(halted("failed_verification", "QA still failing", { qaIssues: ["[render.layout] overflow"] }))).toEqual([]);
  });
});

describe("what is saved, and what 'carry on' does", () => {
  it("a run with a saved site continues the SAME run, reopened (never a second paid build)", () => {
    const j = halted("failed_verification", "QA still failing", { progress: { saved: "built", savedCycle: 2, reopens: 0, state: "halted", haltStatus: "failed_verification" } });
    const d = diagnoseJob(j, [j], { planId: PLAN });
    expect(d.saved).toBe("built");
    expect(d.carryOn).toBe("continue");
    expect(carryOnRequest(j, d, PLAN)).toEqual({ kind: "resume", params: expect.objectContaining({ workflowRunId: RUN, planId: PLAN, reopen: true }) });
  });

  it("an older run (no progress field) is read from its checkpoint", () => {
    expect(savedState(halted("failed_verification", "x", { lastCheckpoint: { stage: "build", cycle: 1 } }))).toBe("built");
    expect(savedState(halted("build_failed", "x"))).toBe("none");
  });

  it("a crashed run keeps its run id so it can continue; a site that no longer matches its hash is rebuilt instead", () => {
    const crashed = job({ error: "AuditWriteError: down", result: { status: "crashed", workflowRunId: RUN, progress: { saved: "none" } } });
    expect(diagnoseJob(crashed, [crashed], { planId: PLAN }).carryOn).toBe("continue");
    const corrupt = halted("checkpoint_corrupt", "no longer matches its checkpoint hash");
    const d = diagnoseJob(corrupt, [corrupt], { planId: PLAN });
    expect(d.carryOn).toBe("rerun");
    expect(carryOnRequest(corrupt, d, PLAN)).toEqual({ kind: "build_plan", params: { planId: PLAN } });
  });

  it("a failure before any run exists runs the same request again; no plan, nothing to press", () => {
    const j = job({ error: "plan x is Track B, but this runner has no Track B builder configured" });
    expect(carryOnRequest(j, diagnoseJob(j, [j], { planId: PLAN }), PLAN)).toEqual({ kind: "build_plan", params: { planId: PLAN } });
    expect(carryOnRequest(j, diagnoseJob(j, [j], {}), null)).toBeNull();
  });

  it("a failed question or re-check just asks again with the same words", () => {
    const j = job({ kind: "ask", params: { question: "What stage is DreamSign in?" }, error: "ANTHROPIC_API_KEY missing for Hermes-lite" });
    expect(carryOnRequest(j, diagnoseJob(j), null)).toEqual({ kind: "ask", params: { question: "What stage is DreamSign in?" } });
  });

  it("a verified run offers nothing to fix", () => {
    const j = halted("awaiting_launch_approval", "", { lastCheckpoint: { stage: "verified", cycle: 1 }, progress: { saved: "verified" } });
    expect(diagnoseJob(j, [j], { planId: PLAN }).carryOn).not.toBe("continue");
  });
});

describe("the same stop, again and again", () => {
  it("three identical stops in a row lead with the report instead of the same button", () => {
    const mk = () => halted("failed_verification", "QA still failing after 2 revision(s)", { qaIssues: ["[render.layout] overflow"] });
    const jobs = [mk(), mk(), mk()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const d = diagnoseJob(jobs[0]!, jobs, { planId: PLAN });
    expect(d.repeating).toBe(true);
    expect(d.reportFirst).toBe(true);
    const two = jobs.slice(0, 2);
    expect(diagnoseJob(two[0]!, two, { planId: PLAN }).repeating).toBe(false);
  });

  it("a different stop in between resets the count", () => {
    const a = () => halted("failed_verification", "QA still failing after 2 revision(s)");
    const jobs = [a(), a(), halted("build_failed", "builder escalated: no response (fetch failed) (after 4 attempts)"), a()].sort((x, y) => y.created_at.localeCompare(x.created_at));
    expect(diagnoseJob(jobs[0]!, jobs, { planId: PLAN }).repeating).toBe(false);
  });
});

describe("the report for Huraira", () => {
  it("says what ran, what the owner was told, and the failed checks, without secrets", () => {
    const j = halted("failed_verification", "QA still failing", { qaIssues: ["[render.layout] overflow on 375px"] });
    const text = reportText(j, diagnoseJob(j, [j], { planId: PLAN }), "Harbor Street Bakery");
    expect(text).toContain("Harbor Street Bakery");
    expect(text).toContain("[render.layout] overflow on 375px");
    expect(text).toContain(RUN);
    expect(text).not.toMatch(/service_role|Bearer /);
  });
});

describe("a worker that never reported back", () => {
  const old = new Date(Date.now() - 50 * 60_000).toISOString();
  it("is shown as stopped, not as running forever, and can be continued", async () => {
    const { isActive } = await import("../jobsClient");
    const { jobState } = await import("./model");
    const { buildAttention } = await import("./attention");
    const j = job({ status: "running", created_at: old });
    expect(isActive(j)).toBe(false);
    expect(jobState(j)).toEqual({ label: "Stopped without reporting", tone: "stop" });
    const { asStopped } = await import("./recovery");
    const d = diagnoseJob(asStopped(j), [j], { planId: PLAN });
    expect(d.cause).toBe("temporary");
    const item = buildAttention({ plans: [], jobs: [{ ...j, params: { planId: PLAN } }], accounts: [], myId: null, canDecide: true }).find((i) => i.kind === "failed");
    expect(item?.title).toMatch(/stopped/);
  });
  it("a build that is merely recent is still running", async () => {
    const { isActive } = await import("../jobsClient");
    expect(isActive(job({ status: "running", created_at: new Date().toISOString() }))).toBe(true);
  });
});

describe("what the run's own record says", () => {
  it("reads what was saved, how it ended and how often it was reopened", async () => {
    const { progressFromAudit } = await import("./recovery");
    const p = progressFromAudit([
      { action: "workflow.start", payload: {} },
      { action: "workflow.checkpoint", payload: { stage: "build", cycle: 0 } },
      { action: "workflow.checkpoint", payload: { stage: "build", cycle: 1 } },
      { action: "workflow.halt", payload: { status: "failed_verification" } },
    ]);
    expect(p).toMatchObject({ saved: "built", savedCycle: 1, state: "halted", haltStatus: "failed_verification", reopens: 0 });
    const again = progressFromAudit([
      { action: "workflow.start", payload: {} },
      { action: "workflow.halt", payload: { status: "failed_verification" } },
      { action: "workflow.reopen", payload: {} },
    ]);
    expect(again).toMatchObject({ state: "running", reopens: 1, saved: "none" });
  });
});
