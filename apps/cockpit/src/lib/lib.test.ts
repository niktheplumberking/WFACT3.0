import { describe, expect, it, vi } from "vitest";

// These are pure functions; the real client (which needs env vars) is never called.
vi.mock("../supabaseClient", () => ({ supabase: {} }));
import { buildAttention, latestBuildByPlan } from "./attention";
import { clientsOf } from "./clients";
import { explainJobError, jobState } from "./model";
import { stageMoveBlock, nextStage } from "../stages";
import { fixtures, JOB_FAILED, JOB_STUCK, JOB_VERIFIED, PLAN_APPROVED, OWNER_ID } from "../test/fake";
import type { JobRow } from "../jobsClient";
import type { AccountRequestRow, PlanRow, ProjectRow } from "./model";

const f = fixtures();
const plans = f.plan_approvals as unknown as PlanRow[];
const jobs = f.jobs as unknown as JobRow[];
const accounts = f.account_requests as unknown as AccountRequestRow[];

const projects = f.projects as unknown as ProjectRow[];
const clientsFor = (pl: PlanRow[], js: JobRow[]) => clientsOf({ plans: pl, projects, jobs: js, inputs: [], viewer: { role: "owner", name: "Test Owner" }, decider: "Test" });

describe("what needs you (Home and Notifications, one source)", () => {
  it("stopped first, then approvals (the proposal, the finished site, the account), oldest first within each", () => {
    const items = buildAttention({ clients: clientsFor(plans, jobs), jobs, accounts, myId: OWNER_ID, canDecide: true });
    expect(items.map((i) => i.kind)).toEqual(["stuck", "plan", "launch", "account"]);
    expect(items.map((i) => i.group)).toEqual(["stopped", "approval", "approval", "approval"]);
    expect(items.filter((i) => i.isDecision)).toHaveLength(3);
  });

  it("speaks the design's words: chip, client, title, one button; owner-only decisions are marked", () => {
    const items = buildAttention({ clients: clientsFor(plans, jobs), jobs, accounts, myId: OWNER_ID, canDecide: true });
    const proposal = items.find((i) => i.kind === "plan")!;
    expect(proposal).toMatchObject({ label: "Your approval", client: "Summit Line Roofing", title: "Approve the proposal", cta: "Review the proposal", ownerOnly: true });
    expect(proposal.why).toBe("Recommended: Fast local site. 6 questions are still open.");
    expect(items.find((i) => i.kind === "launch")).toMatchObject({ client: "Northlight Signs", title: "Approve the finished site", why: "Every check passed.", ownerOnly: true });
    expect(items.find((i) => i.kind === "account")).toMatchObject({ title: "Let Sample Applicant in", ownerOnly: false, href: "/team" });
    for (const i of items) expect(`${i.label} ${i.title} ${i.why} ${i.cta}`).not.toMatch(/\bplan\b|\bjob\b|track [AB]|entity|needs_input|token/i);
  });

  it("does not report a failed build that a later build of the same proposal superseded", () => {
    const items = buildAttention({ clients: clientsFor(plans, jobs), jobs, accounts, myId: OWNER_ID, canDecide: true });
    expect(items.some((i) => i.key === `failed:${JOB_FAILED}`)).toBe(false);
    expect(latestBuildByPlan(jobs).get(PLAN_APPROVED)?.id).toBe(JOB_VERIFIED);
  });

  it("reports the stop when it is the latest build", () => {
    const only = jobs.filter((j) => j.id !== JOB_VERIFIED);
    const items = buildAttention({ clients: clientsFor(plans, only), jobs: only, accounts: [], myId: OWNER_ID, canDecide: true });
    const failed = items.find((i) => i.kind === "failed")!;
    expect(failed).toMatchObject({ group: "stopped", label: "Stopped", client: "Northlight Signs", cta: "See the fix", href: `/activity/${JOB_FAILED}` });
    expect(failed.title).toContain("the site builder is out of credits");
  });

  it("never shows my own account request, and shows nothing to a PM", () => {
    const mine = accounts.map((a) => ({ ...a, user_id: OWNER_ID }));
    expect(buildAttention({ clients: [], jobs: [], accounts: mine, myId: OWNER_ID, canDecide: true })).toHaveLength(0);
    expect(buildAttention({ clients: clientsFor(plans, jobs), jobs, accounts, myId: OWNER_ID, canDecide: false })).toHaveLength(0);
  });
});

describe("plain-language job copy", () => {
  it("explains the Agent 37 credits failure with what to do", () => {
    const e = explainJobError(jobs.find((j) => j.id === JOB_FAILED)!);
    expect(e.headline).toBe("the site builder is out of credits");
    expect(e.todo).toMatch(/money decision/);
    expect(e.todo).toMatch(/Resume build/);
  });

  it("explains a review that could not run (reviewer outage), and the older ambiguous wording, without blaming the site", () => {
    const outage = explainJobError({
      kind: "build_plan",
      error: "deterministic checks passed but a required review could not run (render.design-review: NOT RUN: the agent37 reviewer gave no valid answer after 4 attempts (HTTP 502: upstream_unreachable).) — checks alone are not verification",
      result: { status: "not_verified_no_evaluator" },
      gh_run_url: "x",
    });
    expect(outage.headline).toBe("the final review couldn't run");
    expect(outage.todo).toMatch(/Start the build again/);
    const older = explainJobError({ kind: "build_plan", error: "deterministic checks passed but no evaluator model was configured — checks alone are not verification", result: null, gh_run_url: "x" });
    expect(older.headline).toBe("the final review didn't run");
    expect(older.happened).toMatch(/passed every automatic check/);
  });

  it("explains a missing dispatch token and an unknown error", () => {
    expect(explainJobError({ kind: "build_plan", error: "Dispatcher not configured: GITHUB_DISPATCH_TOKEN is not set", result: null, gh_run_url: null }).headline).toBe("the factory worker isn't connected");
    const unknown = explainJobError({ kind: "ask", error: "Something odd. More detail here.", result: null, gh_run_url: "x" });
    expect(unknown.happened).toBe("Something odd.");
    expect(unknown.todo).toMatch(/GitHub run log/);
  });

  it("labels a request that never reached GitHub", () => {
    expect(jobState(jobs.find((j) => j.id === JOB_STUCK)!).label).toBe("Never started");
    expect(jobState(jobs.find((j) => j.id === JOB_VERIFIED)!).label).toBe("Verified");
  });
});

describe("stage moves (decision D3)", () => {
  it("never offers the move into Launch", () => {
    expect(nextStage("7_qa_security")).toBe("8_launch");
    expect(stageMoveBlock("7_qa_security")).toMatch(/Launch is Nick's decision/);
    expect(stageMoveBlock("6_full_build_owners_key")).toBeNull();
    expect(stageMoveBlock("10_post_mortem")).toMatch(/last stage/);
  });
});
