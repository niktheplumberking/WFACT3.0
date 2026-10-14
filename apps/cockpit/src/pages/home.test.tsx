/**
 * Home (Cockpit v2 phase 5): the headline and its states (empty, all calm, things need you), "What needs you" with one
 * button per row or "<owner> decides this", Running now, the owner-only spend card, and Every client on the six-step
 * path. SYNTHETIC rows only (src/test/fake.ts).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, OWNER_ID, PLAN_APPROVED } from "../test/fake";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";
import { headline } from "./Home";

const T = { timeout: 3000 };

function start(role: Role = "owner", fx = fixtures()) {
  h.fake = createFake(fx);
  render(
    <MemoryRouter initialEntries={["/"]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: role === "admin" ? "Huraira Admin" : "Test Owner" }} />
    </MemoryRouter>,
  );
}

describe("headline", () => {
  it("greets by time of day and counts in words", () => {
    expect(headline(3, "Nick", 9)).toBe("Good morning, Nick. Three things need you.");
    expect(headline(1, "Nick", 14)).toBe("Good afternoon, Nick. One thing needs you.");
    expect(headline(7, "Nick", 20)).toBe("Good evening, Nick. 7 things need you.");
  });
});

describe("Home states", () => {
  it("empty: no clients yet, one way to start", async () => {
    const fx = fixtures();
    fx.plan_approvals = [];
    fx.jobs = [];
    fx.projects = [];
    fx.account_requests = [];
    start("owner", fx);
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome, Test." }, T)).toBeInTheDocument();
    expect(screen.getByText("Your first client starts with a request.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a new request" })).toHaveAttribute("href", "/projects/new");
  });

  it("a failed load is never shown as 'no clients'", async () => {
    h.fake = createFake(fixtures());
    const from = h.fake.client.from.bind(h.fake.client);
    (h.fake.client as { from: unknown }).from = (t: string) => (t === "jobs" ? { select: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: "network down" } }) }) }) } : from(t));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role: "owner", fullName: "Test Owner" }} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "The factory's status could not be loaded." }, T)).toBeInTheDocument();
    expect(screen.getByText(/network down/)).toBeInTheDocument();
    expect(screen.queryByText("Your first client starts with a request.")).toBeNull();
    expect(screen.queryByText(/There are no clients yet/)).toBeNull();
  });

  it("all calm: nothing needs you, and it says what is building", async () => {
    const fx = fixtures();
    fx.plan_approvals = fx.plan_approvals.filter((p) => p.id === PLAN_APPROVED);
    fx.jobs = [{ id: "run-1", created_at: new Date(Date.now() - 4 * 60_000).toISOString(), kind: "build_plan", params: { planId: PLAN_APPROVED }, status: "running", started_at: new Date(Date.now() - 4 * 60_000).toISOString(), finished_at: null, result: null, error: null, gh_run_url: null, archived_at: null }];
    fx.account_requests = [];
    start("owner", fx);
    expect(await screen.findByRole("heading", { level: 1, name: "All calm, Test." }, T)).toBeInTheDocument();
    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();
    expect(screen.getByText(/The factory is building Northlight Signs/)).toBeInTheDocument();
    const running = screen.getByRole("region", { name: "Running now" });
    expect(within(running).getByText("Northlight Signs")).toBeInTheDocument();
    expect(within(running).getByText("Running for")).toBeInTheDocument();
    // fewer than 3 past builds: no made-up time left
    expect(within(running).getByText("Not enough past builds to say")).toBeInTheDocument();
    expect(within(running).getByRole("link", { name: "Watch the build: Northlight Signs" })).toHaveAttribute("href", "/activity/run-1");
  });
});

describe("What needs you, by role", () => {
  it("an admin sees the owner-only decisions as '<owner> decides this', and can still act on the rest", async () => {
    start("admin");
    const list = await screen.findByRole("region", { name: "What needs you" }, T);
    expect(within(list).getAllByText("Test decides this")).toHaveLength(2); // the proposal and the finished site
    expect(within(list).getByRole("link", { name: "Review the request" })).toBeInTheDocument(); // accounts: admins too
    expect(screen.queryByRole("region", { name: "This week" })).toBeNull(); // cost views are owner-only (RLS)
  });

  it("the owner sees the spend against the live cap, from spend-caps.json", async () => {
    start("owner");
    const spend = await screen.findByRole("region", { name: "This week" }, T);
    expect(await within(spend).findByRole("meter", { name: "Spend this week" }, T)).toBeInTheDocument();
    expect(within(spend).getByText(/Each build stops itself at \$\d+\.\d\d\./)).toBeInTheDocument();
  });

  it("a PM sees assigned clients without a path it cannot read, and no decisions", async () => {
    start("pm");
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome, Test." }, T)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "What needs you" })).toBeNull();
    const clients = await screen.findByRole("region", { name: "Your clients" }, T);
    expect(within(clients).getAllByText("Its progress isn't shared with project managers yet.").length).toBeGreaterThan(0);
  });
});

describe("Every client", () => {
  it("each client: name, kind, step N of 6 in words, the next thing and a chip", async () => {
    start();
    const clients = await screen.findByRole("region", { name: "Every client" }, T);
    const rows = within(clients).getAllByRole("listitem");
    const northlight = rows.find((r) => r.textContent?.includes("Northlight Signs"))!;
    expect(northlight).toHaveTextContent("Fast local site");
    expect(northlight).toHaveTextContent("Step 5 of 6 · Ready for approval");
    expect(northlight).toHaveTextContent("Approve the finished site");
    expect(northlight).toHaveTextContent("Waiting on Test Owner");
    const summit = rows.find((r) => r.textContent?.includes("Summit Line Roofing"))!;
    expect(summit).toHaveTextContent("Step 2 of 6 · Proposal");
  });
});
