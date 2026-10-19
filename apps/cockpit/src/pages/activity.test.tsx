/**
 * The Activity room (Cockpit v2 phase 14): filters by client, person and type pills; "Save this view" (this device only);
 * grouped by day; each row says time, who, a plain sentence and the client. Person events go through the one phrase
 * table, factory events come from the job rows and the run's own rows. Owners and admins only (RLS). SYNTHETIC rows only
 * (src/test/fake.ts plus audit rows made here).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, JOB_FAILED, JOB_VERIFIED, OWNER_ID, PLAN_APPROVED } from "../test/fake";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";
import { byDay, type ActivityLine } from "../lib/activity";
import { personLines, type AuditEvent } from "../lib/phrases";

const T = { timeout: 3000 };
const ADMIN_ID = "00000000-0000-4000-8000-0000000000cc";
const NEW_PM = "00000000-0000-4000-8000-0000000000bb";
const RUN_VERIFIED = "77777777-7777-4777-8777-777777777777";
const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const row = (action: string, actor: string, task: string | null, payload: Record<string, unknown>, min: number, run: string | null = null) => ({ id: `${action}-${min}`, occurred_at: at(min), actor, action, task_id: task, run_id: run, payload });
// Words that must never be on screen outside Technical details (brief §8), plus the raw audit slugs.
const BANNED = /\b(plan|job|run id|track [AB]|entity|needs_input|token|sha|claude-|gpt-|gemini|hermes)\b|plan\.decision|plan\.input|job\.requested|account\.approved|return_to_builder/i;

function fx() {
  const f = fixtures();
  f.profiles = [...f.profiles, { id: ADMIN_ID, role: "admin", full_name: "Alex Admin" }, { id: NEW_PM, role: "pm", full_name: "Sample Applicant" }];
  f.audit_log = [
    row("plan.decision", OWNER_ID, PLAN_APPROVED, { status: "approved", buildTrack: "A" }, 120),
    row("plan.input", ADMIN_ID, PLAN_APPROVED, { key: "phone", waived: false }, 110),
    row("job.requested", OWNER_ID, JOB_VERIFIED, { kind: "build_plan", params: { planId: PLAN_APPROVED } }, 100),
    row("job.run", "worker", JOB_VERIFIED, { kind: "build_plan", jobId: JOB_VERIFIED }, 99, RUN_VERIFIED),
    row("workflow.return_to_builder", "worker", null, { cycle: 0, issues: ["[render.perf] slow"] }, 97, RUN_VERIFIED),
    row("account.approved", OWNER_ID, null, { user_id: NEW_PM, email: "new.pm@example.test", role: "pm", decider_role: "owner" }, 60),
  ];
  return f;
}

function start(role: Role = "owner", rows = fx()) {
  h.fake = createFake(rows);
  const me = role === "admin" ? ADMIN_ID : OWNER_ID;
  return render(
    <MemoryRouter initialEntries={["/activity"]}>
      <SignedIn me={{ userId: me, email: "someone@example.test", role, fullName: role === "admin" ? "Alex Admin" : "Test Owner" }} />
    </MemoryRouter>,
  );
}

const rowOf = (text: string | RegExp) => screen.getByText(text, { exact: false }).closest("li")!;
const shown = () => screen.queryAllByRole("listitem").filter((li) => li.classList.contains("activity-row"));

afterEach(() => localStorage.clear());

describe("the Activity room", () => {
  it("lists what the team and the factory did, each with time, who, a plain sentence and the client", async () => {
    start();
    expect(await screen.findByRole("heading", { level: 1, name: "Activity" }, T)).toBeInTheDocument();
    expect(await screen.findByText("Approved the proposal: Fast local site.", {}, T)).toBeInTheDocument();
    const approved = rowOf("Approved the proposal: Fast local site.");
    expect(within(approved).getByText("You")).toBeInTheDocument();
    expect(within(approved).getByText("Northlight Signs")).toBeInTheDocument();
    expect(within(approved).getByText(/^\d\d:\d\d$/)).toBeInTheDocument();
    expect(within(rowOf("Added 1 detail.")).getByText("Alex")).toBeInTheDocument();
    expect(within(rowOf("Started a build.")).getByText("You")).toBeInTheDocument();
    // factory events, from the job rows and the run's own rows
    expect(within(rowOf("Finished: every check passed. Ready for approval.")).getByText("The factory")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Stopped: the site builder is out of credits/ })).toHaveAttribute("href", `/activity/${JOB_FAILED}`);
    expect(within(rowOf("Started a round of fixes")).getByText("Northlight Signs")).toBeInTheDocument();
    // team: no client
    expect(within(rowOf("Approved Sample’s account as a project manager.")).getByText("No client")).toBeInTheDocument();
    expect(shown()).toHaveLength(7);
  });

  it("groups rows by day under a heading", async () => {
    start();
    await screen.findByText("Approved the proposal: Fast local site.", {}, T);
    const days = screen.getAllByRole("heading", { level: 2 });
    expect(days.length).toBeGreaterThan(0);
    for (const d of days) expect(d.textContent).toMatch(/^(Today|Yesterday|\w{3} \d{1,2} \w{3})$/);
  });

  it("shows no raw action slugs or engineering words", async () => {
    start();
    await screen.findByText("Approved the proposal: Fast local site.", {}, T);
    const main = screen.getByRole("heading", { level: 1, name: "Activity" }).closest(".activity")!;
    expect(main.textContent).not.toMatch(BANNED);
  });

  it("filters by type with pressed pills, one at a time", async () => {
    start();
    await screen.findByText("Approved the proposal: Fast local site.", {}, T);
    const pills = within(screen.getByRole("group", { name: "Type" })).getAllByRole("button");
    expect(pills.map((b) => b.textContent)).toEqual(["Everything", "Decisions", "Builds", "Stops", "Fix rounds", "Details", "Team"]);
    expect(pills.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent)).toEqual(["Everything"]);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Stops" }));
    expect(screen.getByRole("button", { name: "Stops" })).toHaveAttribute("aria-pressed", "true");
    expect(shown()).toHaveLength(1);
    expect(shown()[0]).toHaveTextContent("Stopped: the site builder is out of credits");
    await user.click(screen.getByRole("button", { name: "Team" }));
    expect(shown()).toHaveLength(1);
    expect(shown()[0]).toHaveTextContent("Approved Sample’s account as a project manager.");
    await user.click(screen.getByRole("button", { name: "Decisions" }));
    expect(shown()).toHaveLength(1);
  });

  it("filters by client and by person, and says so when nothing matches", async () => {
    start();
    await screen.findByText("Approved the proposal: Fast local site.", {}, T);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Person" }), "The factory");
    expect(shown().every((li) => within(li).queryByText("The factory"))).toBe(true);
    expect(shown()).toHaveLength(3);
    await user.selectOptions(screen.getByRole("combobox", { name: "Client" }), "Northlight Signs");
    await user.click(screen.getByRole("button", { name: "Team" }));
    expect(shown()).toHaveLength(0);
    expect(screen.getAllByRole("status").some((s) => s.textContent?.includes("Nothing matches these filters yet."))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Show everything" }));
    expect(shown()).toHaveLength(7);
  });

  it("saves the view on this device only, says so, and opens with it next time", async () => {
    const r = start();
    await screen.findByText("Approved the proposal: Fast local site.", {}, T);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Stops" }));
    await user.click(screen.getByRole("button", { name: "Save this view" }));
    expect(await screen.findByText(/Saved on this device/, {}, T)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(`cockpit-activity-view:${OWNER_ID}`)!)).toMatchObject({ type: "stop" });
    r.unmount();
    start();
    await screen.findByText(/Stopped: the site builder is out of credits/, {}, T);
    expect(screen.getByRole("button", { name: "Stops" })).toHaveAttribute("aria-pressed", "true");
    expect(shown()).toHaveLength(1);
  });

  it("has no primary button (it is a record, nothing to act on)", async () => {
    start();
    await screen.findByText("Approved the proposal: Fast local site.", {}, T);
    const main = screen.getByRole("heading", { level: 1, name: "Activity" }).closest(".activity")!;
    expect(main.querySelectorAll(".btn.primary")).toHaveLength(0);
  });

  it("admins see it too, and their own actions read as You", async () => {
    start("admin");
    expect(await screen.findByText("Added 1 detail.", {}, T)).toBeInTheDocument();
    expect(within(rowOf("Added 1 detail.")).getByText("You")).toBeInTheDocument();
  });

  it("project managers do not see it (audit trail and builds are owner/admin under RLS)", async () => {
    start("pm");
    expect(await screen.findByText("Activity is for owners and admins.", {}, T)).toBeInTheDocument();
    expect(shown()).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "Type" })).not.toBeInTheDocument();
  });

  it("says so when nothing has happened yet", async () => {
    const f = fixtures();
    f.jobs = [];
    f.audit_log = [];
    start("owner", f);
    expect(await screen.findByText("Nothing has happened yet.", {}, T)).toBeInTheDocument();
  });

  it("shows the database's answer when the read fails, with a way to try again", async () => {
    h.fake = createFake(fx());
    const from = h.fake.client.from;
    const failing = () => {
      const api = { select: () => api, in: () => api, eq: () => api, order: () => api, limit: () => api, then: (resolve: (r: unknown) => void) => resolve({ data: null, error: { message: "permission denied for table audit_log" } }) };
      return api;
    };
    (h.fake.client as { from: unknown }).from = (t: string) => (t === "audit_log" ? failing() : from(t));
    render(
      <MemoryRouter initialEntries={["/activity"]}>
        <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role: "owner", fullName: "Test Owner" }} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Couldn't load the activity.", {}, T)).toBeInTheDocument();
    expect(screen.getByText(/permission denied for table audit_log/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("the phrase table behind it", () => {
  const ev = (action: string, payload: Record<string, unknown>): AuditEvent => ({ id: action, occurred_at: at(1), actor: OWNER_ID, action, task_id: null, payload });
  it("leaves out actions and request kinds it does not know, rather than showing a slug", () => {
    expect(personLines([ev("plan.something_new", {}), ev("job.requested", { kind: "mystery" }), ev("account.approved", { role: "superuser" })], {})).toEqual([]);
  });
  it("says an account decision in plain words, with a role word", () => {
    expect(personLines([ev("account.approved", { user_id: "x", role: "admin" })], { x: "Sam" }).map((l) => l.verb)).toEqual(["approved Sam’s account as an admin"]);
    expect(personLines([ev("account.rejected", { user_id: "x" })], {}).map((l) => l.verb)).toEqual(["declined an account request"]);
  });
});

describe("grouping by day", () => {
  const line = (iso: string): ActivityLine => ({ key: iso, at: iso, actor: "factory", text: "x", type: "build", glyph: "finished", client: null, jobId: null });
  it("names today, yesterday, then the date, newest first", () => {
    const now = new Date(2026, 9, 16, 12, 0);
    const days = byDay([line(new Date(2026, 9, 14, 9).toISOString()), line(new Date(2026, 9, 16, 10).toISOString()), line(new Date(2026, 9, 15, 23).toISOString()), line(new Date(2026, 9, 16, 11).toISOString())], now);
    expect(days.map((d) => [d.label, d.items.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      ["Wed 14 Oct", 1],
    ]);
    expect(days[0]!.items[0]!.at > days[0]!.items[1]!.at).toBe(true);
  });
});
