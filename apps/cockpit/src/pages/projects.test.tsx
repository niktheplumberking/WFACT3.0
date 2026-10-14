/**
 * Projects (Cockpit v2 phase 6): summary sentence, search, sort, group, filter pills with counts (aria-pressed),
 * Grid/List (the list is role=table), pins, "Save this view", the no-match state, and the PM view.
 * SYNTHETIC rows only (src/test/fake.ts): clients Summit Line Roofing (proposal waiting), Northlight Signs (ready for
 * approval), and two projects with no proposal (DreamSign (pilot), Harbor Street Bakery).
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
afterEach(() => localStorage.clear());

function start(role: Role = "owner") {
  h.fake = createFake(fixtures());
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/projects"]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return user;
}

const cards = () => screen.getAllByRole("listitem").filter((li) => li.classList.contains("project-card"));
const names = () => cards().map((c) => c.querySelector(".project-name")?.textContent);

describe("Projects", () => {
  it("leads with a summary sentence and shows every client as a card", async () => {
    start();
    expect(await screen.findByText("4 clients. 2 are waiting on someone.", {}, T)).toBeInTheDocument();
    // "Needs someone first": both wait on someone, then by name; the two without a readable proposal after.
    expect(names()).toEqual(["Northlight Signs", "Summit Line Roofing", "DreamSign (pilot)", "Harbor Street Bakery"]);
    const northlight = cards()[0]!;
    expect(northlight).toHaveTextContent("Step 5 of 6 · Ready for approval");
    expect(northlight).toHaveTextContent("Approve the finished site");
    expect(within(northlight).getByText("Passed every check")).toBeInTheDocument();
  });

  it("filter pills say how many and are pressed buttons", async () => {
    const user = start();
    await screen.findByText(/clients\./, {}, T);
    const filters = screen.getByRole("group", { name: "Filter" });
    const ready = within(filters).getByRole("button", { name: /Ready for approval\s*1/ });
    expect(within(filters).getByRole("button", { name: /All\s*4/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(ready);
    expect(ready).toHaveAttribute("aria-pressed", "true");
    expect(names()).toEqual(["Northlight Signs"]);
  });

  it("search, and an honest no-match state with a way back", async () => {
    const user = start();
    await screen.findByText(/clients\./, {}, T);
    await user.type(screen.getByLabelText("Search clients"), "Bennett");
    expect(screen.getByText("No client matches “Bennett”.").closest('[role="status"]')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear the search" }));
    expect(names()).toHaveLength(4);
  });

  it("List is a table with headers; pins move a client to the top and are remembered", async () => {
    const user = start();
    await screen.findByText(/clients\./, {}, T);
    await user.click(screen.getByRole("radio", { name: "List" }));
    const table = screen.getByRole("table", { name: "Projects" });
    expect(within(table).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Pin", "Client", "On the path", "Next step", "Waiting on", "Last build"]);
    const pin = within(table).getByRole("button", { name: "Pin Harbor Street Bakery" });
    expect(pin).toHaveAttribute("aria-pressed", "false");
    await user.click(pin);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Harbor Street Bakery");
    expect(within(table).getByRole("button", { name: "Unpin Harbor Street Bakery" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(localStorage.getItem("cockpit-pins")!)).toEqual({ "project:proj-7": true });
  });

  it("Save this view keeps search, filter, sort, group and Grid/List for next time, with Undo", async () => {
    const user = start();
    await screen.findByText(/clients\./, {}, T);
    await user.selectOptions(screen.getByRole("combobox", { name: /Group/ }), "kind");
    await user.click(screen.getByRole("button", { name: "Save this view" }));
    expect(JSON.parse(localStorage.getItem("cockpit-projects-view")!)).toMatchObject({ group: "kind", view: "grid" });
    expect(await screen.findByRole("button", { name: "Undo" }, T)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Fast local site" })).toBeInTheDocument();
  });

  it("technical ids sit in a closed Technical details drawer in Simple", async () => {
    start();
    await screen.findByText(/clients\./, {}, T);
    const drawer = cards()[0]!.querySelector("details")!;
    expect(drawer).not.toHaveAttribute("open");
    expect(drawer).toHaveTextContent("Technical details");
  });

  it("a PM sees assigned clients without progress it cannot read, and no hand-add form", async () => {
    start("pm");
    expect(await screen.findByText("2 clients. 0 are waiting on someone.", {}, T)).toBeInTheDocument();
    expect(screen.getAllByText("Its progress isn't shared with project managers yet.")).toHaveLength(2);
    expect(screen.queryByText("Add a client or project by hand")).toBeNull();
  });
});
