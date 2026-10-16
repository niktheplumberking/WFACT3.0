/**
 * Settings (Cockpit v2 phase 17, brief §6.13): searchable group nav; Appearance edits a draft with a live preview, a
 * sticky "N unsaved changes / Save / Discard" bar and Undo after saving; Home order, visibility and where the Cockpit
 * opens; saved views; keyboard; budget from spend-caps.json (owner/admin); region and team defaults said as fixed.
 * Everything is kept on this device and the page says so. SYNTHETIC rows only (src/test/fake.ts).
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
import { CAPS, usd } from "../lib/costs";
import { SHORTCUTS } from "../shell/Shell";

const T = { timeout: 3000 };

function start(path = "/settings", role: Role = "owner") {
  h.fake = createFake(fixtures());
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return { user, calls: () => h.fake.calls };
}
const nav = async () => within(await screen.findByRole("navigation", { name: "Settings groups" }, T));
const savebar = () => document.querySelector(".set-savebar") as HTMLElement | null;
const groupNames = async () => (await nav()).getAllByRole("button").map((b) => b.textContent);

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-accent");
});

describe("Settings: the group nav", () => {
  it("lists every group, says settings are kept on this device, and keeps sign out", async () => {
    const t = start();
    expect(await screen.findByRole("heading", { level: 1, name: "Settings" }, T)).toBeInTheDocument();
    expect(await groupNames()).toEqual(["Appearance", "Detail level", "Home", "Notifications", "Saved views", "Keyboard", "Budget", "Language and region", "Team defaults"]);
    expect(screen.getByText(/kept on this device for now/)).toBeInTheDocument();
    await t.user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(t.calls()).toContainEqual({ op: "signOut" });
  });

  it("searches groups by what they hold, and says when nothing matches", async () => {
    const t = start();
    await nav();
    await t.user.type(screen.getByRole("textbox", { name: "Search settings" }), "currency");
    expect(await groupNames()).toEqual(["Language and region"]);
    await t.user.clear(screen.getByRole("textbox", { name: "Search settings" }));
    await t.user.type(screen.getByRole("textbox", { name: "Search settings" }), "zzz");
    expect((await nav()).getByRole("status")).toHaveTextContent("No setting matches “zzz”.");
  });

  it("opens the group named in the address and marks it current", async () => {
    start("/settings?group=keys");
    expect(await screen.findByRole("heading", { level: 2, name: "Keyboard" }, T)).toBeInTheDocument();
    expect((await nav()).getByRole("button", { name: "Keyboard" })).toHaveAttribute("aria-current", "page");
  });

  it("hides Budget from project managers (caps are owner/admin)", async () => {
    start("/settings?group=budget", "pm");
    expect(await groupNames()).not.toContain("Budget");
    expect(screen.getByRole("heading", { level: 2, name: "Appearance" })).toBeInTheDocument();
  });
});

describe("Settings: Appearance edits a draft", () => {
  it("previews a change without applying it, then saves it with Undo", async () => {
    const t = start();
    const theme = within(await screen.findByRole("group", { name: "Theme" }, T));
    await t.user.click(theme.getByRole("button", { name: "Dark" }));
    expect(theme.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    // the page itself has not changed; the preview has
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(document.querySelector(".appearance-preview")).toHaveAttribute("data-theme", "dark");
    expect(savebar()).toHaveAttribute("role", "status");
    expect(savebar()).toHaveTextContent("1 unsaved change. The preview shows them; nothing changes until you save.");
    await t.user.click(within(savebar()!).getByRole("button", { name: "Save" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(JSON.parse(localStorage.getItem("cockpit-appearance")!)).toMatchObject({ theme: "dark" });
    expect(await screen.findByText("Saved on this device.", {}, T)).toBeInTheDocument();
    await t.user.click(screen.getByRole("button", { name: "Undo" }));
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(JSON.parse(localStorage.getItem("cockpit-appearance")!)).toMatchObject({ theme: "light" });
  });

  it("counts every unsaved change, and Discard drops them", async () => {
    const t = start();
    await t.user.click(within(await screen.findByRole("group", { name: "Accent colour" }, T)).getByRole("button", { name: "Moss" }));
    await t.user.click(within(screen.getByRole("group", { name: "Text size" })).getByRole("button", { name: "Larger" }));
    await t.user.click(screen.getByRole("checkbox", { name: /Movement/ }));
    expect(savebar()).toHaveTextContent("3 unsaved changes.");
    expect(document.querySelector(".appearance-preview")).toHaveAttribute("data-accent", "moss");
    await t.user.click(screen.getByRole("button", { name: "Discard" }));
    expect(savebar()).toBeNull();
    expect(localStorage.getItem("cockpit-appearance")).toBeNull();
  });
});

describe("Settings: Home", () => {
  it("hides, reorders and keeps the sections on this device", async () => {
    const t = start("/settings?group=home");
    expect(await screen.findByRole("heading", { level: 2, name: "Home" }, T)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move What needs you up" })).toBeDisabled();
    await t.user.click(screen.getByRole("button", { name: "Move What needs you down" }));
    await t.user.click(screen.getByRole("checkbox", { name: "Every client" }));
    expect(JSON.parse(localStorage.getItem("cockpit-home")!)).toEqual({ order: ["overview", "needs", "clients"], hidden: ["clients"] });
  });

  it("chooses where the Cockpit opens", async () => {
    const t = start("/settings?group=home");
    const select = await screen.findByRole("combobox", { name: "Open the Cockpit on" }, T);
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Home: what needs me", "Projects", "Activity"]);
    await t.user.selectOptions(select, "/projects");
    expect(JSON.parse(localStorage.getItem("cockpit-landing")!)).toBe("/projects");
  });

  it("project managers get Home and Projects only", async () => {
    start("/settings?group=home", "pm");
    const select = await screen.findByRole("combobox", { name: "Open the Cockpit on" }, T);
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Home: what needs me", "Projects"]);
  });

  it("opening the Cockpit at Home goes to the chosen room, once per tab", async () => {
    localStorage.setItem("cockpit-landing", JSON.stringify("/projects"));
    start("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Projects" }, T)).toBeInTheDocument();
    expect(sessionStorage.getItem("cockpit-opened")).toBe("1");
  });
});

describe("Settings: the other groups", () => {
  it("lists the views saved on this device in words, and deletes one", async () => {
    localStorage.setItem("cockpit-projects-view", JSON.stringify({ query: "", filter: "stop", sort: "name", group: "none", view: "list" }));
    localStorage.setItem(`cockpit-activity-view:${OWNER_ID}`, JSON.stringify({ client: "Northlight Signs", person: "all", type: "stop" }));
    const t = start("/settings?group=views");
    const g = within((await screen.findByRole("heading", { level: 2, name: "Saved views" }, T)).closest("section")!);
    expect(g.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["ProjectsStopped · by name · listDelete", "ActivityStops · Northlight SignsDelete"]);
    await t.user.click(screen.getByRole("button", { name: "Delete the saved Projects view" }));
    expect(localStorage.getItem("cockpit-projects-view")).toBeNull();
    expect(await screen.findByText("Projects opens with its usual view again.", {}, T)).toBeInTheDocument();
  });

  it("says when no view is saved", async () => {
    start("/settings?group=views");
    expect(await screen.findByText(/No views are saved on this device/, {}, T)).toBeInTheDocument();
  });

  it("lists the real keyboard shortcuts", async () => {
    start("/settings?group=keys");
    const g = within((await screen.findByRole("heading", { level: 2, name: "Keyboard" }, T)).closest("section")!);
    expect(g.getAllByRole("term").map((d) => d.textContent)).toEqual(SHORTCUTS.map(([, d]) => d));
  });

  it("shows the live caps from the factory's settings, with no change button", async () => {
    start("/settings?group=budget");
    const g = within((await screen.findByRole("heading", { level: 2, name: "Budget" }, T)).closest("section")!);
    expect(g.getByText(usd(CAPS.perBuildUsd!))).toBeInTheDocument();
    expect(g.getByText(usd(CAPS.weeklyUsd!))).toBeInTheDocument();
    expect(g.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says notifications reach the Cockpit only, with nothing to switch", async () => {
    start("/settings?group=notify");
    const g = within((await screen.findByRole("heading", { level: 2, name: "Notifications" }, T)).closest("section")!);
    expect(g.getByText(/Email and phone are not connected yet/)).toBeInTheDocument();
    expect(g.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("says formats and team defaults are fixed for now", async () => {
    const t = start("/settings?group=region");
    expect(await screen.findByText(/These are fixed for now/, {}, T)).toBeInTheDocument();
    await t.user.click((await nav()).getByRole("button", { name: "Team defaults" }));
    const g = within((await screen.findByRole("heading", { level: 2, name: "Team defaults" }, T)).closest("section")!);
    expect(g.getByText(/Owners can’t change these yet/)).toBeInTheDocument();
    expect(g.getAllByRole("definition").map((d) => d.textContent)).toEqual([
      "Simple · opens on Home · notifications in the Cockpit",
      "Detailed · opens on Home · notifications in the Cockpit",
      "Simple · opens on Home · notifications in the Cockpit",
    ]);
  });
});
