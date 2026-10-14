/**
 * New request (Cockpit v2 phase 7): labelled fields with hints, the logo drop zone, one primary with the cost beside it,
 * the money confirm, and no made-up figures. SYNTHETIC rows only (src/test/fake.ts).
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
import { requestTextWith } from "./Work";

const T = { timeout: 3000 };

function start(role: Role = "owner") {
  h.fake = createFake(fixtures());
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/projects/new"]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return { user, calls: () => h.fake.calls };
}

describe("New request", () => {
  it("has the design's fields, each labelled, and one primary", async () => {
    start();
    expect(await screen.findByRole("heading", { level: 1, name: "New request" }, T)).toBeInTheDocument();
    expect(screen.getByLabelText("What did the client ask for?")).toHaveAccessibleDescription(/quotes the client's own words/);
    expect(screen.getByLabelText("Client's business name")).toBeInTheDocument();
    expect(screen.getByLabelText(/Their live web address/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Drop the logo here, or choose a file/)).toHaveAttribute("type", "file");
    const main = screen.getByRole("main");
    expect(within(main).getAllByRole("button").filter((b) => b.classList.contains("primary"))).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Send to the factory" })).toBeDisabled(); // nothing to send yet
  });

  it("says what happens next, without made-up times or prices", async () => {
    start();
    const next = await screen.findByRole("complementary", { name: "What happens next" }, T);
    expect(within(next).getAllByRole("listitem")).toHaveLength(5);
    // The fixtures have fewer than 3 past runs of anything: no "usually" figures, only the live per-build stop.
    expect(next).not.toHaveTextContent(/Usually about/);
    expect(next).toHaveTextContent(/Each build stops itself at \$\d+\.\d\d\./);
    expect(screen.getByText("Costs a few cents to read and write the proposal.")).toBeInTheDocument();
  });

  it("checks the live address before anything is sent", async () => {
    const { user, calls } = start();
    await user.type(await screen.findByLabelText("What did the client ask for?", {}, T), "A site please.");
    await user.type(screen.getByLabelText(/Their live web address/), "not a web address");
    await user.click(screen.getByRole("button", { name: "Send to the factory" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByLabelText(/Their live web address/)).toHaveAttribute("aria-invalid", "true");
    expect(calls().some((c) => c.op === "insert")).toBe(false);
  });

  it("'Not now' sends nothing", async () => {
    const { user, calls } = start();
    await user.type(await screen.findByLabelText("What did the client ask for?", {}, T), "A site please.");
    await user.click(screen.getByRole("button", { name: "Send to the factory" }));
    await user.click(within(await screen.findByRole("alertdialog", {}, T)).getByRole("button", { name: "Not now" }));
    expect(calls().some((c) => c.op === "insert")).toBe(false);
  });

  it("the business name travels as a labelled first line (intake reads only the text)", () => {
    expect(requestTextWith("Hello", "  Harbor Street Bakery ")).toBe("Business name: Harbor Street Bakery\n\nHello");
    expect(requestTextWith("Hello", "")).toBe("Hello");
  });
});
