/**
 * Team and access (Cockpit v2 phase 16, brief §6.12): account requests approved as a role or declined with a note,
 * through the existing decide_account_request rpc; the people list with the clients each follows; roles in plain words.
 * Owners and admins only; admins approve project managers only. No invite form and no per-person "Change" (nothing
 * behind them yet). SYNTHETIC rows only (src/test/fake.ts plus rows made here).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, OWNER_ID } from "../test/fake";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";
import { ago } from "./Team";

const T = { timeout: 3000 };
const APPLICANT = "00000000-0000-4000-8000-0000000000bb";
const ADMIN_ID = "00000000-0000-4000-8000-0000000000cc";
const PM_ID = "00000000-0000-4000-8000-0000000000dd";
const PM_NEW = "00000000-0000-4000-8000-0000000000ee";
const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function fx() {
  const f = fixtures();
  f.profiles = [
    { id: OWNER_ID, role: "owner", full_name: "Test Owner" },
    { id: ADMIN_ID, role: "admin", full_name: "Alex Admin" },
    { id: PM_ID, role: "pm", full_name: "Sam Manager" },
    { id: PM_NEW, role: "pm", full_name: "Robin New" },
  ];
  f.profile_clients = [
    { profile_id: PM_ID, client_id: "c1", clients: { name: "Harbor Street Bakery" } },
    { profile_id: PM_ID, client_id: "c2", clients: { name: "Summit Line Roofing" } },
  ];
  f.account_requests = [
    { user_id: APPLICANT, email: "new.pm@example.test", full_name: "Sample Applicant", status: "pending", requested_at: at(120), decided_role: null, decision_note: null },
    { user_id: PM_ID, email: "sam@example.test", full_name: "Sam Manager", status: "approved", requested_at: at(9000), decided_role: "pm", decision_note: null },
  ];
  return f;
}

function start(role: Role = "owner", rows = fx()) {
  h.fake = createFake(rows);
  const user = userEvent.setup();
  const me = role === "admin" ? ADMIN_ID : role === "pm" ? PM_ID : OWNER_ID;
  render(
    <MemoryRouter initialEntries={["/team"]}>
      <SignedIn me={{ userId: me, email: "me@example.test", role, fullName: "Someone" }} />
    </MemoryRouter>,
  );
  return { user, calls: () => h.fake.calls };
}
const requests = async () => within(await screen.findByRole("region", { name: "Waiting for your approval" }, T));

describe("Team and access", () => {
  it("shows who asked for an account, and when", async () => {
    start();
    expect(await screen.findByRole("heading", { level: 1, name: "Team and access" }, T)).toBeInTheDocument();
    const r = await requests();
    expect(await r.findByText("new.pm@example.test", {}, T)).toBeInTheDocument();
    expect(r.getByText(/asked for an account \(Sample Applicant\) · 2 hours ago/)).toBeInTheDocument();
  });

  it("an owner approves as a project manager by default, through the existing rpc", async () => {
    const t = start();
    const r = await requests();
    await t.user.click(await r.findByRole("button", { name: "Approve as project manager" }, T));
    expect(t.calls()).toContainEqual({ op: "rpc", name: "decide_account_request", args: { p_user_id: APPLICANT, p_decision: "approve", p_role: "pm", p_note: null } });
    expect(await screen.findByText("new.pm@example.test can now sign in as a project manager.", {}, T)).toBeInTheDocument();
  });

  it("an owner can choose another role, and the button says which", async () => {
    const t = start();
    const r = await requests();
    await t.user.selectOptions(await r.findByRole("combobox", { name: "Role" }, T), "owner");
    await t.user.click(r.getByRole("button", { name: "Approve as owner" }));
    expect(t.calls()).toContainEqual({ op: "rpc", name: "decide_account_request", args: { p_user_id: APPLICANT, p_decision: "approve", p_role: "owner", p_note: null } });
  });

  it("an admin approves project managers only: no role choice", async () => {
    start("admin");
    const r = await requests();
    expect(await r.findByRole("button", { name: "Approve as project manager" }, T)).toBeInTheDocument();
    expect(r.queryByRole("combobox", { name: "Role" })).not.toBeInTheDocument();
    expect(r.getByText("As an admin you can approve project managers only.")).toBeInTheDocument();
  });

  it("declining asks why and records it", async () => {
    const t = start();
    const r = await requests();
    await t.user.click(await r.findByRole("button", { name: "Decline" }, T));
    const dlg = await screen.findByRole("alertdialog", { name: "Decline new.pm@example.test?" }, T);
    const confirm = within(dlg).getByRole("button", { name: "Decline the request" });
    expect(confirm).toBeDisabled();
    await t.user.type(within(dlg).getByLabelText("Why"), "Not part of the team");
    await t.user.click(confirm);
    expect(t.calls()).toContainEqual({ op: "rpc", name: "decide_account_request", args: { p_user_id: APPLICANT, p_decision: "reject", p_role: null, p_note: "Not part of the team" } });
  });

  it("says plainly when the decision was not recorded", async () => {
    const t = start();
    (h.fake.client as { rpc: unknown }).rpc = async () => ({ error: { message: "an admin can only approve pm accounts" } });
    const r = await requests();
    await t.user.click(await r.findByRole("button", { name: "Approve as project manager" }, T));
    expect(await screen.findByText("Your decision wasn't recorded: an admin can only approve pm accounts. Nothing changed.", {}, T)).toBeInTheDocument();
  });

  it("lists people with their role in plain words and the clients they follow", async () => {
    start();
    const ppl = within(await screen.findByRole("region", { name: "People" }, T));
    const rows = await ppl.findAllByRole("listitem", {}, T);
    const text = rows.map((li) => li.textContent);
    expect(text).toEqual([
      "TTest Owner (you)me@example.testOwnerAll clients",
      "AAlex AdminNo email on fileAdminAll clients",
      "SSam Managersam@example.testProject managerHarbor Street Bakery, Summit Line Roofing",
      "RRobin NewNo email on fileProject managerNo clients assigned yet",
    ]);
  });

  it("offers no invite form and no change buttons, and says why", async () => {
    start();
    const inv = within(await screen.findByRole("region", { name: "Invite someone" }, T));
    expect(inv.getByText(/The Cockpit can’t send invites yet/)).toBeInTheDocument();
    expect(inv.queryByRole("textbox")).not.toBeInTheDocument();
    expect(inv.queryByRole("button")).not.toBeInTheDocument();
    const ppl = within(screen.getByRole("region", { name: "People" }));
    await ppl.findAllByRole("listitem", {}, T);
    expect(ppl.queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains each role", async () => {
    start();
    const roles = within(await screen.findByRole("region", { name: "What each role can do" }, T));
    expect(roles.getAllByRole("term").map((d) => d.textContent)).toEqual(["Owner", "Admin", "Project manager"]);
  });

  it("has one primary button even with several requests", async () => {
    const f = fx();
    f.account_requests = [...f.account_requests, { user_id: "00000000-0000-4000-8000-0000000000ff", email: "second@example.test", full_name: null, status: "pending", requested_at: at(30), decided_role: null, decision_note: null }];
    start("owner", f);
    await (await requests()).findByText("second@example.test", {}, T);
    expect(document.querySelectorAll(".team .btn.primary")).toHaveLength(1);
  });

  it("says when nobody is waiting", async () => {
    const f = fx();
    f.account_requests = f.account_requests.filter((r) => r.status !== "pending");
    start("owner", f);
    expect(await (await requests()).findByText(/Nobody is waiting/, {}, T)).toBeInTheDocument();
  });

  it("project managers do not see it (RLS)", async () => {
    start("pm");
    expect(await screen.findByText("Team and access is for owners and admins.", {}, T)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "People" })).not.toBeInTheDocument();
  });
});

describe("how long ago", () => {
  it("says it in words", () => {
    const now = Date.parse("2026-10-16T12:00:00Z");
    expect(ago("2026-10-16T11:59:40Z", now)).toBe("just now");
    expect(ago("2026-10-16T11:48:00Z", now)).toBe("12 minutes ago");
    expect(ago("2026-10-16T10:00:00Z", now)).toBe("2 hours ago");
    expect(ago("2026-10-15T09:00:00Z", now)).toBe("yesterday");
    expect(ago("2026-10-10T09:00:00Z", now)).toBe("10 Oct");
  });
});
