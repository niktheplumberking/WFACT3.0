import { describe, expect, it, vi } from "vitest";

// These are pure functions; the real client (which needs env vars) is never called.
vi.mock("../supabaseClient", () => ({ supabase: {} }));
import { buildAttention, latestBuildByPlan, statusLine } from "./attention";
import { explainJobError, jobState } from "./model";
import { stageMoveBlock, nextStage } from "../stages";
import { fixtures, JOB_FAILED, JOB_STUCK, JOB_VERIFIED, PLAN_APPROVED, OWNER_ID } from "../test/fake";
import type { JobRow } from "../jobsClient";
import type { AccountRequestRow, PlanRow } from "./model";

const f = fixtures();
const plans = f.plan_approvals as unknown as PlanRow[];
const jobs = f.jobs as unknown as JobRow[];
const accounts = f.account_requests as unknown as AccountRequestRow[];

describe("what needs you (Home)", () => {
  it("lists the pending plan, the account request, the launch decision and the stuck request, oldest first", () => {
    const items = buildAttention({ plans, jobs, accounts, myId: OWNER_ID, canDecide: true });
    expect(items.map((i) => i.kind)).toEqual(["stuck", "plan", "launch", "account"]);
    expect(items.filter((i) => i.isDecision)).toHaveLength(3);
  });

  it("does not report a failed build that a later build of the same plan superseded", () => {
    const items = buildAttention({ plans, jobs, accounts, myId: OWNER_ID, canDecide: true });
    expect(items.some((i) => i.key === `failed:${JOB_FAILED}`)).toBe(false);
    expect(latestBuildByPlan(jobs).get(PLAN_APPROVED)?.id).toBe(JOB_VERIFIED);
  });

  it("reports the failure when it is the latest build", () => {
    const only = jobs.filter((j) => j.id !== JOB_VERIFIED);
    const items = buildAttention({ plans, jobs: only, accounts: [], myId: OWNER_ID, canDecide: true });
    const failed = items.find((i) => i.kind === "failed");
    expect(failed?.title).toContain("the site builder is out of credits");
    expect(failed?.href).toBe(`/activity/${JOB_FAILED}`);
  });

  it("never shows my own account request, and shows nothing to a PM", () => {
    const mine = accounts.map((a) => ({ ...a, user_id: OWNER_ID }));
    expect(buildAttention({ plans: [], jobs: [], accounts: mine, myId: OWNER_ID, canDecide: true })).toHaveLength(0);
    expect(buildAttention({ plans, jobs, accounts, myId: OWNER_ID, canDecide: false })).toHaveLength(0);
  });

  it("says one plain sentence", () => {
    const items = buildAttention({ plans, jobs, accounts, myId: OWNER_ID, canDecide: true });
    expect(statusLine(items)).toBe("3 decisions are waiting for you, and 1 thing needs fixing.");
    expect(statusLine([])).toBe("Nothing needs you right now.");
  });
});

describe("plain-language job copy", () => {
  it("explains the Agent 37 credits failure with what to do", () => {
    const e = explainJobError(jobs.find((j) => j.id === JOB_FAILED)!);
    expect(e.headline).toBe("the site builder is out of credits");
    expect(e.todo).toMatch(/money decision/);
    expect(e.todo).toMatch(/Resume build/);
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
