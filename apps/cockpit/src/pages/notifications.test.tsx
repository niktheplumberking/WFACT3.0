/**
 * Notifications (Cockpit v2 phase 18, brief §6 screen 14): an Inbox / Preferences tablist; the Inbox from the same
 * source as Home attention (unread dot and "Unread.", chip, time, title, line; a row opens its target; "Mark all as
 * read" clears every dot and the shell bell); loading, failed and empty states; a PM gets nothing (attention is for
 * owners and admins); Preferences shows only the channel that really delivers, with no dead controls.
 * SYNTHETIC rows only (src/test/fake.ts).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createFake, fixtures, OWNER_ID } from "../test/fake";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";
import { NOTIFY_LINES } from "../lib/prefs";

const T = { timeout: 3000 };
const BANNED = /\b(plan|job|run id|track [AB]|entity|needs_input|token|sha|claude-|gpt-|gemini|hermes)\b/i;

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function start(role: Role = "owner", fx = fixtures(), patch?: (from: (t: string) => unknown) => (t: string) => unknown) {
  h.fake = createFake(fx);
  if (patch) {
    const from = h.fake.client.from.bind(h.fake.client);
    (h.fake.client as { from: unknown }).from = patch(from);
  }
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/notifications"]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
      <Where />
    </MemoryRouter>,
  );
  return { user };
}

const inbox = () => document.getElementById("notif-panel-inbox")!;
const prefs = () => document.getElementById("notif-panel-prefs")!;
const rows = () => within(inbox()).getAllByRole("listitem");
const room = () => screen.getByRole("heading", { level: 1, name: "Notifications" }).closest(".notif-page") as HTMLElement;

afterEach(() => localStorage.clear());

describe("Notifications: the Inbox / Preferences tabs", () => {
  it("is a tablist of two tabs, each controlling its panel; arrows, Home and End move and choose", async () => {
    const t = start();
    const list = await screen.findByRole("tablist", { name: "Notifications" }, T);
    const [inboxTab, prefsTab] = within(list).getAllByRole("tab");
    expect(inboxTab).toHaveTextContent("Inbox");
    expect(prefsTab).toHaveTextContent("Preferences");
    expect(inboxTab).toHaveAttribute("aria-selected", "true");
    expect(prefsTab).toHaveAttribute("aria-selected", "false");
    expect(inboxTab).toHaveAttribute("aria-controls", "notif-panel-inbox");
    expect(prefsTab).toHaveAttribute("aria-controls", "notif-panel-prefs");
    expect(inbox()).toHaveAttribute("role", "tabpanel");
    expect(inbox()).toHaveAttribute("aria-labelledby", inboxTab.id);
    expect(inbox()).toBeVisible();
    expect(prefs()).not.toBeVisible();
    // one tab stop: only the chosen tab is in the tab order
    expect(inboxTab).toHaveAttribute("tabindex", "0");
    expect(prefsTab).toHaveAttribute("tabindex", "-1");

    inboxTab.focus();
    await t.user.keyboard("{ArrowRight}");
    expect(prefsTab).toHaveAttribute("aria-selected", "true");
    expect(prefsTab).toHaveFocus();
    expect(prefs()).toBeVisible();
    expect(inbox()).not.toBeVisible();
    await t.user.keyboard("{ArrowRight}");
    expect(inboxTab).toHaveFocus();
    expect(inboxTab).toHaveAttribute("aria-selected", "true");
    await t.user.keyboard("{End}");
    expect(prefsTab).toHaveFocus();
    await t.user.keyboard("{Home}");
    expect(inboxTab).toHaveFocus();
    await t.user.keyboard("{ArrowLeft}");
    expect(prefsTab).toHaveFocus();
    expect(prefsTab).toHaveAttribute("aria-selected", "true");
  });
});

describe("Notifications: the Inbox", () => {
  it("shows every Home attention item, unread with a dot and 'Unread.' for screen readers", async () => {
    start();
    await screen.findByRole("button", { name: "Mark all as read" }, T);
    expect(rows()).toHaveLength(4);
    expect(inbox().querySelectorAll(".unread-dot:not(.read)")).toHaveLength(4);
    expect(within(inbox()).getAllByText("Unread.")).toHaveLength(4);
    expect(within(inbox()).queryAllByText("Stopped").length + within(inbox()).queryAllByText("Needs you").length).toBe(4);
    // the account request is in words, with its target
    expect(within(inbox()).getByText("Let Sample Applicant in")).toBeInTheDocument();
  });

  it("a row opens its target", async () => {
    const t = start();
    await screen.findByRole("button", { name: "Mark all as read" }, T);
    await t.user.click(within(inbox()).getByText("Let Sample Applicant in").closest("button")!);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/team"), T);
  });

  it("Mark all as read clears every dot and the shell bell count", async () => {
    const t = start();
    expect((await screen.findAllByRole("link", { name: "Notifications, 4 unread" }, T)).length).toBeGreaterThan(0);
    await t.user.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(inbox().querySelectorAll(".unread-dot:not(.read)")).toHaveLength(0);
    expect(within(inbox()).queryAllByText("Unread.")).toHaveLength(0);
    expect(rows()).toHaveLength(4);
    expect(screen.queryAllByRole("link", { name: /unread/ })).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Notifications" }).length).toBeGreaterThan(0);
  });

  it("empty: says what will appear, with nothing to mark", async () => {
    const fx = fixtures();
    fx.plan_approvals = [];
    fx.jobs = [];
    fx.projects = [];
    fx.account_requests = [];
    start("owner", fx);
    expect(await screen.findByText("Nothing needs you right now.", {}, T)).toBeInTheDocument();
    expect(screen.getByText(/appear here and on Home as soon as they happen/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark all as read" })).toBeNull();
  });

  it("loading: says so while the factory is read, never 'nothing needs you'", async () => {
    start("owner", fixtures(), (from) => (t) => (t === "jobs" ? { select: () => ({ order: () => ({ limit: () => new Promise(() => {}) }) }) } : from(t)));
    expect(await screen.findByText("Loading your notifications…", {}, T)).toBeInTheDocument();
    expect(screen.queryByText("Nothing needs you right now.")).toBeNull();
  });

  it("a failed load says what failed and offers to try again, never 'nothing needs you'", async () => {
    start("owner", fixtures(), (from) => (t) => (t === "jobs" ? { select: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: "network down" } }) }) }) } : from(t)));
    expect(await screen.findByText("Couldn't load your notifications.", {}, T)).toBeInTheDocument();
    expect(screen.getByText(/network down/)).toBeInTheDocument();
    expect(within(inbox()).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Nothing needs you right now.")).toBeNull();
  });

  it("a PM gets only what attention gives a PM: nothing, and says where their clients are", async () => {
    const t = start("pm");
    expect(await screen.findByText("Nothing needs you right now.", {}, T)).toBeInTheDocument();
    expect(within(inbox()).getByText(/go to the owner and admins/)).toBeInTheDocument();
    expect(within(inbox()).queryAllByRole("listitem")).toHaveLength(0);
    await t.user.click(screen.getByRole("tab", { name: "Preferences" }));
    expect(within(prefs()).queryByRole("table")).toBeNull();
    expect(within(prefs()).getByText(/nothing is sent to you here yet/)).toBeInTheDocument();
    expect(within(prefs()).queryByText(NOTIFY_LINES.where)).toBeNull();
  });
});

describe("Notifications: Preferences", () => {
  it("shows only the channel that delivers, always on, with no dead controls", async () => {
    const t = start();
    await t.user.click(await screen.findByRole("tab", { name: "Preferences" }, T));
    const p = within(prefs());
    expect(p.getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["When", "In the app"]);
    expect(p.getAllByRole("rowheader").map((c) => c.querySelector("b")!.textContent)).toEqual(["Something needs me", "A build finished", "A build stopped"]);
    expect(p.getAllByText("Always on")).toHaveLength(3);
    expect(p.queryByRole("checkbox")).toBeNull();
    expect(p.queryByRole("combobox")).toBeNull();
    expect(p.queryByRole("columnheader", { name: /Email|Phone/ })).toBeNull();
    expect(p.getByText(NOTIFY_LINES.where)).toBeInTheDocument();
    expect(p.getByText(NOTIFY_LINES.channels)).toBeInTheDocument();
    expect(p.getByText(NOTIFY_LINES.quiet)).toBeInTheDocument();
    expect(p.getByText(/Spend near the cap is not a notification yet/)).toBeInTheDocument();
    expect(p.getByRole("link", { name: "Settings, Notifications" })).toHaveAttribute("href", "/settings?group=notify");
  });

  it("an admin is not told about spend (Costs is owner-only)", async () => {
    const t = start("admin");
    await t.user.click(await screen.findByRole("tab", { name: "Preferences" }, T));
    expect(within(prefs()).getByRole("table")).toBeInTheDocument();
    expect(within(prefs()).queryByText(/Spend near the cap/)).toBeNull();
  });
});

describe("Notifications: words", () => {
  it("shows no engineering words in either tab", async () => {
    start();
    await screen.findByRole("button", { name: "Mark all as read" }, T);
    const clone = room().cloneNode(true) as HTMLElement;
    clone.querySelectorAll("details").forEach((d) => d.remove());
    expect(clone.textContent).toContain("Always on");
    expect(clone.textContent).not.toMatch(BANNED);
  });
});
