/**
 * The Decisions room and stage moves (Cockpit v2, Package 4 R3, option b: kept and restyled in the Projects grammar):
 * title and summary sentence, the three kinds of decision as pill links, titled rows with a status chip (glyph and word),
 * the stage move behind its confirm, and never a move into Launch (decision D3). SYNTHETIC rows only (src/test/fake.ts).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, OWNER_ID, PLAN_PENDING } from "../test/fake";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";

const T = { timeout: 3000 };
const BANNED = /\b(plan|plans|job|jobs|run|runs|track [AB]|entity|needs_input|tokens?|sha|github|workflow|claude-\S*|gpt-\S*|gemini|hermes|agent \d+)\b/i;

function start(path: string, role: Role = "owner") {
  h.fake = createFake(fixtures());
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <SignedIn me={{ userId: OWNER_ID, email: "someone@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return { user, calls: () => h.fake.calls };
}

const main = () => screen.getByRole("main");
function wordsOutsideDetails(): string {
  const copy = main().cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details, dialog:not([open])").forEach((d) => d.remove());
  return copy.textContent ?? "";
}
const rowOf = (name: string) => screen.getByRole("link", { name }).closest("li")!;

describe("the Decisions room", () => {
  it("title, a summary sentence, the kinds of decision as links, and the waiting proposal as a row with a chip", async () => {
    start("/decisions");
    expect(await screen.findByRole("heading", { level: 1, name: "Decisions" }, T)).toBeInTheDocument();
    expect(within(main()).getByText(/^\d+ decisions? (is|are) waiting\. Each decision is recorded/)).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Decision types" });
    expect(within(nav).getByRole("link", { name: /Proposals/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /Stage moves/ })).toHaveAttribute("href", "/decisions/stages");
    const waiting = screen.getByRole("region", { name: "Proposals waiting" });
    const row = within(waiting).getByRole("link", { name: "Summit Line Roofing Website" });
    expect(row).toHaveAttribute("href", `/decisions/plans/${PLAN_PENDING}`);
    expect(within(row.closest("li")!).getByText("Your decision")).toHaveClass("chip-need");
    expect(wordsOutsideDetails()).not.toMatch(BANNED);
  });

  it("recently decided proposals carry their own chip", async () => {
    start("/decisions");
    const decided = await screen.findByRole("region", { name: "Recently decided" }, T);
    expect(within(decided).getByText("Approved")).toHaveClass("chip-done");
  });

  it("an admin is told who decides, not 'Your decision'", async () => {
    start("/decisions", "admin");
    const waiting = await screen.findByRole("region", { name: "Proposals waiting" }, T);
    expect(within(waiting).queryByText("Your decision")).toBeNull();
    expect(within(waiting).getByText(/ decides$/)).toBeInTheDocument();
  });
});

describe("stage moves", () => {
  it("each project is a row; the move confirms first, then updates only that project's stage", async () => {
    const t = start("/decisions/stages");
    expect(await screen.findByRole("heading", { level: 1, name: "Decisions" }, T)).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Decision types" })).getByRole("link", { name: /Stage moves/ })).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("navigation", { name: "Decision types" })).getByRole("link", { name: /Proposals/ })).not.toHaveAttribute("aria-current");
    const row = await screen.findByRole("link", { name: "DreamSign homepage" }, T).then((l) => l.closest("li")!);
    await t.user.click(within(row).getByRole("button", { name: /^Move to / }));
    expect(t.calls().some((c) => c.op === "update")).toBe(false);
    const dialog = await screen.findByRole("alertdialog", {}, T);
    await t.user.click(within(dialog).getByRole("button", { name: /^Move to / }));
    expect(t.calls()).toContainEqual(expect.objectContaining({ op: "update", table: "projects", filters: [["id", "proj-6"], ["stage", "6_full_build_owners_key"]] }));
    expect(wordsOutsideDetails()).not.toMatch(BANNED);
  });

  it("never offers a move into Launch (decision D3)", async () => {
    start("/decisions/stages");
    await screen.findByRole("link", { name: "Harbor bakery site" }, T);
    const row = rowOf("Harbor bakery site");
    expect(within(row).queryByRole("button")).toBeNull();
    expect(within(row).getByText(/Launch is Nick's decision/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /launch/i })).toBeNull();
  });

  it("a project manager sees where each project is, but no move and no Accounts link (RLS: owner/admin only)", async () => {
    start("/decisions/stages", "pm");
    await screen.findByRole("link", { name: "DreamSign homepage" }, T);
    expect(within(rowOf("DreamSign homepage")).queryByRole("button")).toBeNull();
    expect(within(main()).getByText(/An owner or admin moves a project to its next stage/)).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Decision types" })).queryByRole("link", { name: /Accounts/ })).toBeNull();
  });
});
