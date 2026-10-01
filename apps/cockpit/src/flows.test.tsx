/**
 * Navigation and main-flow tests (Step 4C). Each walkthrough task starts on Home and counts clicks, so the
 * "≤ 3 clicks from home" acceptance is checked by a test as well as in the browser. The Supabase client is
 * a recording fake with SYNTHETIC rows (src/test/fake.ts); RLS itself is proven by the SQL attack tests.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, JOB_FAILED, JOB_STUCK, OWNER_ID, PLAN_APPROVED, PLAN_PENDING, RUN_FAILED } from "./test/fake";
import type { Role } from "./lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("./test/fake").createFake> }));
vi.mock("./supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "./App";

const T = { timeout: 3000 };

function start(path = "/", role: Role = "owner") {
  h.fake = createFake(fixtures());
  let clicks = 0;
  const user = userEvent.setup();
  const click = async (el: Element) => {
    clicks++;
    await user.click(el);
  };
  render(
    <MemoryRouter initialEntries={[path]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return { user, click, clicks: () => clicks, calls: () => h.fake.calls };
}

const mainNav = () => screen.getAllByRole("navigation", { name: "Main navigation" })[0]!;

describe("Home answers 'is everything OK, and what needs me?'", () => {
  it("leads with one sentence and lists what needs a person", async () => {
    start();
    expect(await screen.findByRole("heading", { level: 1, name: "3 decisions are waiting for you, and 1 thing needs fixing." }, T)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Approve or reject the Summit Line Roofing Website plan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Decide on launching the Summit Line Roofing Website build" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1 request never started" })).toBeInTheDocument();
    expect(within(mainNav()).getByRole("link", { name: "Decisions 3 waiting" })).toBeInTheDocument();
  });

  it("shows the future rooms honestly, with their step", async () => {
    const t = start();
    const system = await within(mainNav()).findByRole("link", { name: /System\s*Step 9/ }, T);
    await t.click(system);
    expect(await screen.findByText("Coming in Step 9", {}, T)).toBeInTheDocument();
    expect(screen.getByText(/shows nothing rather than made-up numbers/)).toBeInTheDocument();
  });

  it("hides owner/admin controls from a PM", async () => {
    start("/", "pm");
    expect(await screen.findByRole("heading", { level: 1, name: "Your projects" }, T)).toBeInTheDocument();
    expect(within(mainNav()).queryByRole("link", { name: /Decisions/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /New request/ })).toBeNull();
    expect(within(mainNav()).queryByRole("link", { name: /Costs/ })).toBeNull();
  });
});

describe("walkthrough tasks, each ≤ 3 clicks from Home", () => {
  it("start intake from a pasted request (2 clicks)", async () => {
    const t = start();
    await t.click(await screen.findByRole("link", { name: "New request" }, T));
    await t.user.type(await screen.findByLabelText("Paste it exactly as it came", {}, T), "Hi, we're a small bakery and need a site.");
    await t.click(screen.getByRole("button", { name: "Read request and plan" }));
    expect(t.calls()).toContainEqual(expect.objectContaining({ op: "insert", table: "jobs", values: expect.objectContaining({ kind: "intake", params: { text: "Hi, we're a small bakery and need a site." } }) }));
    expect(t.calls()).toContainEqual(expect.objectContaining({ op: "invoke", name: "dispatch-job" }));
    expect(t.clicks()).toBe(2);
  });

  it("approve a plan as the recommended track (2 clicks)", async () => {
    const t = start();
    await t.click(await screen.findByRole("link", { name: "Approve or reject the Summit Line Roofing Website plan" }, T));
    await t.click(await screen.findByRole("button", { name: "Approve as Track A" }, T));
    const update = t.calls().find((c) => c.op === "update" && c.table === "plan_approvals");
    expect(update?.values).toEqual({ status: "approved", decision_note: null, build_track: "A" });
    expect(update?.filters).toEqual([["id", PLAN_PENDING], ["status", "pending"]]);
    expect(t.clicks()).toBe(2);
  });

  it("approve on the other track (3 clicks), and it says the override is recorded", async () => {
    const t = start();
    await t.click(await screen.findByRole("link", { name: "Approve or reject the Summit Line Roofing Website plan" }, T));
    await t.click(await screen.findByRole("radio", { name: /Track B/ }, T));
    expect(screen.getByText(/against the recommendation/)).toBeInTheDocument();
    await t.click(screen.getByRole("button", { name: "Approve as Track B" }));
    expect(t.calls().find((c) => c.op === "update")?.values).toEqual({ status: "approved", decision_note: null, build_track: "B" });
    expect(t.clicks()).toBe(3);
  });

  it("refuses to reject without a note, then rejects with one (2 clicks)", async () => {
    const t = start();
    await t.click(await screen.findByRole("link", { name: "Approve or reject the Summit Line Roofing Website plan" }, T));
    await t.user.click(await screen.findByRole("button", { name: "Reject with note" }, T));
    expect(screen.getByText(/Write a note before rejecting/)).toBeInTheDocument();
    expect(t.calls().some((c) => c.op === "update")).toBe(false);
    await t.user.type(screen.getByLabelText("Or reject it with a note for the planner"), "Warmer tone, add prices");
    await t.click(screen.getByRole("button", { name: "Reject with note" }));
    expect(t.calls().find((c) => c.op === "update")?.values).toEqual({ status: "rejected", decision_note: "Warmer tone, add prices" });
    expect(t.clicks()).toBe(2);
  });

  it("start a build of an approved plan (3 clicks)", async () => {
    const t = start();
    await t.click(await within(mainNav()).findByRole("link", { name: /Decisions/ }, T));
    const decided = await screen.findByRole("region", { name: "Recently decided" }, T);
    await t.click(within(decided).getByRole("link", { name: "Summit Line Roofing Website" }));
    await t.click(await screen.findByRole("button", { name: "Build it again" }, T));
    expect(t.calls()).toContainEqual(expect.objectContaining({ op: "insert", table: "jobs", values: expect.objectContaining({ kind: "build_plan", params: { planId: PLAN_APPROVED } }) }));
    expect(t.clicks()).toBe(3);
  });

  it("open a run and see why it failed, then resume", async () => {
    const t = start(`/activity/${JOB_FAILED}`);
    expect(await screen.findByRole("heading", { level: 1, name: "Build stopped: the site builder is out of credits" }, T)).toBeInTheDocument();
    expect(screen.getByText(/Topping up Agent 37 is a money decision/)).toBeInTheDocument();
    expect(screen.getByText(/A later build of the same plan passed every check/)).toBeInTheDocument();
    await t.click(screen.getByRole("button", { name: "Resume build" }));
    expect(t.calls()).toContainEqual(expect.objectContaining({ op: "insert", table: "jobs", values: expect.objectContaining({ kind: "resume", params: { workflowRunId: RUN_FAILED } }) }));
  });

  it("approve an account request with a role (2 clicks and a role choice)", async () => {
    const t = start();
    await t.click(await screen.findByRole("link", { name: "Review the account request from Sample Applicant" }, T));
    await t.user.selectOptions(await screen.findByLabelText("Role", {}, T), "admin");
    await t.click(screen.getByRole("button", { name: "Approve" }));
    expect(t.calls()).toContainEqual({ op: "rpc", name: "decide_account_request", args: { p_user_id: "00000000-0000-4000-8000-0000000000bb", p_decision: "approve", p_role: "admin", p_note: null } });
    expect(t.clicks()).toBe(2);
  });

  it("sign out (2 clicks)", async () => {
    const t = start();
    await t.click(await screen.findByRole("button", { name: /Test Owner/ }, T));
    await t.click(screen.getByRole("button", { name: "Sign out" }));
    expect(t.calls()).toContainEqual({ op: "signOut" });
    expect(t.clicks()).toBe(2);
  });
});

describe("gates and tidying", () => {
  it("never offers to move a project into Launch (D3), and confirms other moves", async () => {
    const t = start("/decisions/stages");
    expect(await screen.findByText(/Launch is Nick's decision and is recorded outside the Cockpit/, {}, T)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move to Launch/ })).toBeNull();
    await t.click(screen.getByRole("button", { name: "Move to QA and security" }));
    const dialog = await screen.findByRole("dialog", {}, T);
    expect(within(dialog).getByText(/doesn't build, publish or bill anything/)).toBeInTheDocument();
    await t.click(within(dialog).getByRole("button", { name: "Move to QA and security" }));
    const update = t.calls().find((c) => c.op === "update" && c.table === "projects");
    expect(update?.values).toEqual({ stage: "7_qa_security" });
    expect(update?.filters).toEqual([["id", "proj-6"], ["stage", "6_full_build_owners_key"]]);
  });

  it("closes a request that never started, with a reason (D7)", async () => {
    const t = start(`/activity/${JOB_STUCK}`);
    expect(await screen.findByRole("heading", { level: 1, name: "This request never started" }, T)).toBeInTheDocument();
    await t.click(screen.getByRole("button", { name: "Close it" }));
    const dialog = await screen.findByRole("dialog", {}, T);
    await t.user.type(within(dialog).getByLabelText("Reason"), "Never reached GitHub");
    await t.click(within(dialog).getByRole("button", { name: "Close request" }));
    expect(t.calls()).toContainEqual({ op: "rpc", name: "cancel_job", args: { p_job_id: JOB_STUCK, p_reason: "Never reached GitHub" } });
  });

  it("old room addresses still land somewhere sensible", async () => {
    start("/approvals");
    expect(await screen.findByRole("heading", { level: 1, name: "Decisions" }, T)).toBeInTheDocument();
  });
});
