/**
 * The unknown-address page (Cockpit v2, Package 4 R5): the grammar of the "soon" page (Newsreader title, plain lead, one
 * link back to Home), with no pre-v2 page header left. An unknown "soon" room lands here too. SYNTHETIC rows only.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, OWNER_ID } from "../test/fake";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";

const T = { timeout: 3000 };

function start(path: string) {
  h.fake = createFake(fixtures());
  render(
    <MemoryRouter initialEntries={[path]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role: "owner", fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
}

describe("an address that leads nowhere", () => {
  for (const path of ["/this-does-not-exist", "/soon/no-such-room"]) {
    it(`${path}: a v2 title, a plain lead and one way back to Home`, async () => {
      start(path);
      const h1 = await screen.findByRole("heading", { level: 1, name: "There's nothing at this address." }, T);
      expect(h1).toHaveClass("t-title");
      expect(screen.getByText("The link may be old, or the page may need a role you don't have.")).toHaveClass("t-lead");
      const home = screen.getByRole("link", { name: "Go to Home" });
      expect(home).toHaveAttribute("href", "/");
      expect(home).toHaveClass("btn", "primary");
      const main = screen.getByRole("main");
      expect(main.querySelectorAll(".btn.primary")).toHaveLength(1);
      expect(main.querySelector(".page-head")).toBeNull();
    });
  }
});
