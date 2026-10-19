/**
 * Cockpit v2 shell (phase 3): the typeset wordmark, who sees which room (RLS, not the design, where they disagree),
 * the command palette with "Ask the factory a question", the keyboard shortcuts, the bell and per-route titles.
 * The Supabase client is the recording fake with SYNTHETIC rows (src/test/fake.ts).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
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

const T = { timeout: 3000 };

function start(path = "/", role: Role = "owner") {
  h.fake = createFake(fixtures());
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return { user, calls: () => h.fake.calls };
}

const mainNav = () => screen.getAllByRole("navigation", { name: "Main navigation" })[0]!;
const navNames = () => within(mainNav()).getAllByRole("link").map((a) => a.textContent?.replace(/\d+\s*waiting/, "").trim());

afterEach(() => localStorage.clear());

describe("rail and wordmark", () => {
  it("is a typeset wordmark, with no WF glyph tile", async () => {
    start();
    const mark = await screen.findByRole("link", { name: "WFACT Cockpit, Home" }, T);
    expect(mark).toHaveTextContent("WFACTCockpit");
    expect(document.querySelector(".mark-glyph")).toBeNull();
  });

  it("owner: Home, Projects, Activity, Costs, Team, Notifications, Settings, then Coming later", async () => {
    start();
    await screen.findByRole("heading", { level: 1 }, T);
    expect(navNames()).toEqual(["Home", "Projects", "Activity", "Costs", "Team", "Notifications", "Settings", "System", "Agents", "Memory", "Business"]);
  });

  it("admin: no Costs (model_traces is owner-only in RLS)", async () => {
    start("/", "admin");
    await screen.findByRole("heading", { level: 1 }, T);
    expect(navNames()).not.toContain("Costs");
    expect(navNames()).toContain("Team");
  });

  it("PM: no Activity, Costs, Team or New request (RLS: owner/admin only)", async () => {
    start("/", "pm");
    await screen.findByRole("heading", { level: 1 }, T);
    expect(navNames()).toEqual(["Home", "Projects", "Notifications", "Settings", "System", "Agents", "Memory", "Business"]);
    expect(screen.queryByRole("link", { name: /New request/ })).toBeNull();
    const tabs = screen.getByRole("navigation", { name: "Phone navigation" });
    expect(within(tabs).queryByRole("link", { name: /New/ })).toBeNull();
  });

  it("the Simple/Detailed switch sits in the rail and the D key flips it", async () => {
    const t = start();
    await screen.findByRole("heading", { level: 1 }, T);
    const group = within(screen.getByRole("complementary", { name: "Main" })).getByRole("radiogroup", { name: "Detail level" });
    expect(within(group).getByRole("radio", { name: "Simple" })).toHaveAttribute("aria-checked", "true");
    await t.user.keyboard("d");
    expect(within(group).getByRole("radio", { name: "Detailed" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("top bar", () => {
  it("has a breadcrumb, the search button, the bell with its unread count, and New request", async () => {
    start("/projects/new");
    const crumbs = await screen.findByRole("navigation", { name: "Breadcrumb" }, T);
    expect(within(crumbs).getByRole("link", { name: "Projects" })).toBeInTheDocument();
    expect(within(crumbs).getByText("New request")).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("button", { name: "Search or run a command" }).length).toBeGreaterThan(0);
    // fixtures: 3 decisions + 1 stuck request, none read yet
    expect((await screen.findAllByRole("link", { name: "Notifications, 4 unread" }, T)).length).toBeGreaterThan(0);
    expect(document.title).toBe("New request · WFACT Cockpit");
  });

  it("the Ask box is gone from the top bar (it is a palette action now)", async () => {
    start();
    await screen.findByRole("heading", { level: 1 }, T);
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByPlaceholderText("Ask the factory a question")).toBeNull();
  });
});

describe("command palette", () => {
  it("opens with Ctrl+K; groups real clients, actions, rooms and settings", async () => {
    const t = start();
    await screen.findByRole("heading", { level: 1 }, T);
    await t.user.keyboard("{Control>}k{/Control}");
    const input = await screen.findByRole("combobox", { name: "Search clients, builds, actions and settings" }, T);
    expect(input).toHaveFocus();
    for (const g of ["Clients", "Actions", "Go to", "Settings"]) expect(screen.getByRole("group", { name: g })).toBeInTheDocument();
    const clients = within(screen.getByRole("group", { name: "Clients" }));
    expect(clients.getByRole("option", { name: /Summit Line Roofing\s*Proposal · Approve the proposal/ })).toBeInTheDocument();
    expect(clients.getByRole("option", { name: /Northlight Signs\s*Ready for approval · Approve the finished site/ })).toBeInTheDocument();
  });

  it("asks the factory the typed question through requestJob('ask')", async () => {
    const t = start();
    await screen.findByRole("heading", { level: 1 }, T);
    await t.user.keyboard("/");
    await t.user.type(await screen.findByRole("combobox", {}, T), "Why did the last build stop?");
    const ask = screen.getByRole("option", { name: /Ask the factory a question/ });
    await t.user.click(ask);
    await vi.waitFor(() => expect(t.calls()).toContainEqual(expect.objectContaining({ op: "insert", table: "jobs", values: expect.objectContaining({ kind: "ask", params: { question: "Why did the last build stop?" } }) })));
  });

  it("G then P goes to Projects; ? opens the shortcuts sheet", async () => {
    const t = start();
    await screen.findByRole("heading", { level: 1 }, T);
    await t.user.keyboard("gp");
    await vi.waitFor(() => expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Projects")).toHaveAttribute("aria-current", "page"));
    await t.user.keyboard("?");
    const sheet = await screen.findByRole("dialog", { name: "Keyboard shortcuts" }, T);
    expect(within(sheet).getByText("Switch Simple or Detailed")).toBeInTheDocument();
  });
});

describe("notifications", () => {
  it("lists what needs you from the Home source; Mark all as read clears the bell", async () => {
    const t = start("/notifications");
    expect(await screen.findByRole("heading", { level: 1, name: "Notifications" }, T)).toBeInTheDocument();
    expect(await screen.findByText(/: Approve the proposal$/, {}, T)).toBeInTheDocument();
    await t.user.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect((await screen.findAllByRole("link", { name: "Notifications" }, T)).length).toBeGreaterThan(0);
  });
});
