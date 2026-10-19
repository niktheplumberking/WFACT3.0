/**
 * A proposal decided without a build (Cockpit v2, Package 4 R2): the proposal review's page, read-only, with the decided
 * line. Changes asked for: the note, then "Revise from my note" for owners and admins (the same re-plan request, after a
 * cost confirm), refused after two revisions, and never asked twice. Approved before the kind of site existed: no build
 * button, one way forward (a new request). SYNTHETIC rows only (src/test/fake.ts).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, OWNER_ID, PLAN_APPROVED, PLAN_PENDING } from "../test/fake";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";

const T = { timeout: 3000 };
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const BANNED = /\b(plan|plans|job|jobs|run|runs|track [AB]|entity|needs_input|tokens?|sha|github|workflow|claude-\S*|gpt-\S*|gemini|hermes|agent \d+)\b/i;
type Rows = ReturnType<typeof fixtures>;

function start(id: string, change: (f: Rows) => void, role: Role = "owner") {
  const f = fixtures();
  change(f);
  h.fake = createFake(f);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[`/decisions/plans/${id}`]}>
      <SignedIn me={{ userId: OWNER_ID, email: "someone@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return { user, calls: () => h.fake.calls };
}

const rejected = (revision = 1) => (f: Rows) => {
  f.plan_approvals = f.plan_approvals.map((p) => (p.id === PLAN_PENDING ? { ...p, status: "rejected", decision_note: "Warmer tone, add prices", decided_at: ago(30), revision } : p));
};
const noKind = (f: Rows) => {
  f.plan_approvals = f.plan_approvals.map((p) => (p.id === PLAN_APPROVED ? { ...p, build_track: null } : p));
  f.jobs = f.jobs.filter((j) => (j.params as { planId?: string }).planId !== PLAN_APPROVED);
};

const main = () => screen.getByRole("main");
// Page buttons only: a closed confirm dialog is in the DOM but not on screen.
const primaries = () => [...main().querySelectorAll("button, a")].filter((b) => b.classList.contains("primary") && !b.closest("dialog:not([open])"));
function wordsOutsideDetails(): string {
  const copy = main().cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details").forEach((d) => d.remove());
  return copy.textContent ?? "";
}

describe("a proposal where changes were asked for", () => {
  it("shows the proposal read-only, the decided line and the note; one primary; plain words", async () => {
    start(PLAN_PENDING, rejected());
    expect(await screen.findByRole("heading", { level: 1, name: "A site for Summit Line Roofing" }, T)).toBeInTheDocument();
    expect(within(main()).getByRole("status")).toHaveTextContent(/^Changes asked for on /);
    expect(screen.getByText("“Warmer tone, add prices”")).toBeInTheDocument();
    expect(within(main()).queryByRole("radiogroup")).toBeNull();
    expect(primaries().map((b) => b.textContent)).toEqual(["Revise from my note"]);
    expect(wordsOutsideDetails()).not.toMatch(BANNED);
  });

  it("owner: Revise from my note confirms the cost, then asks for the same re-plan", async () => {
    const t = start(PLAN_PENDING, rejected());
    await t.user.click(await screen.findByRole("button", { name: "Revise from my note" }, T));
    expect(t.calls().some((c) => c.op === "insert")).toBe(false);
    const dialog = await screen.findByRole("alertdialog", {}, T);
    expect(dialog).toHaveTextContent(/Costs a few cents/);
    await t.user.click(within(dialog).getByRole("button", { name: "Revise from my note" }));
    expect(t.calls()).toContainEqual(expect.objectContaining({ op: "insert", table: "jobs", values: expect.objectContaining({ kind: "replan", params: { planId: PLAN_PENDING } }) }));
    expect(t.calls().some((c) => c.op === "invoke" && c.name === "dispatch-job")).toBe(true);
  });

  it("admin can revise too", async () => {
    start(PLAN_PENDING, rejected(), "admin");
    expect(await screen.findByRole("button", { name: "Revise from my note" }, T)).toBeEnabled();
  });

  it("a project manager sees the decision but no button", async () => {
    start(PLAN_PENDING, rejected(), "pm");
    expect(await within(await screen.findByRole("main", {}, T)).findByRole("status", {}, T)).toHaveTextContent(/Changes asked for/);
    expect(screen.queryByRole("button", { name: "Revise from my note" })).toBeNull();
    expect(screen.getByText(/can ask the factory for a new proposal from this note/)).toBeInTheDocument();
  });

  it("after two revisions it refuses a third and offers a new request instead", async () => {
    const t = start(PLAN_PENDING, rejected(2));
    expect(await screen.findByText(/two new proposals already, the limit/, {}, T)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revise from my note" })).toBeNull();
    expect(screen.getByRole("link", { name: "Start a new request" })).toHaveAttribute("href", "/projects/new");
    expect(t.calls().some((c) => c.op === "insert")).toBe(false);
  });

  it("a revision already asked for is opened, not asked for twice", async () => {
    start(PLAN_PENDING, (f) => {
      rejected()(f);
      f.jobs = [...f.jobs, { id: "rp-1", created_at: ago(5), kind: "replan", params: { planId: PLAN_PENDING }, status: "running", started_at: ago(4), finished_at: null, result: null, error: null, gh_run_url: null, archived_at: null }];
    });
    expect(await screen.findByRole("link", { name: "See proposal 2 being written" }, T)).toHaveAttribute("href", "/activity/rp-1");
    expect(screen.queryByRole("button", { name: "Revise from my note" })).toBeNull();
  });
});

describe("a proposal approved before the kind of site existed", () => {
  it("says it can't be built, offers a new request, and has no build button", async () => {
    start(PLAN_APPROVED, noKind);
    expect(await within(await screen.findByRole("main", {}, T)).findByRole("status", {}, T)).toHaveTextContent(/^Approved on .*, without a kind of site\.$/);
    expect(screen.getByText(/It can't be built: a build needs the kind of site/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /build/i })).toBeNull();
    expect(primaries().map((b) => b.textContent)).toEqual(["Start a new request"]);
    expect(wordsOutsideDetails()).not.toMatch(BANNED);
  });
});
