/**
 * The finished site review (Cockpit v2 phase 13): chips, title, placeholder rows with "Should show", the owner-only
 * launch tick, the readiness line, Technical details, and an Approve button that stays off because nothing can record a
 * site approval yet (BLOCKED-ON-NICK.md). SYNTHETIC rows only (src/test/fake.ts).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, JOB_VERIFIED, OWNER_ID } from "../test/fake";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";

const T = { timeout: 3000 };

function start(role: Role = "owner", placeholders = true) {
  const fx = fixtures();
  const job = fx.jobs.find((j) => j.id === JOB_VERIFIED)!;
  job.result = {
    ...(job.result as object),
    checks: [
      { checkId: "render.perf", passed: true },
      { checkId: "render.a11y", passed: true },
    ],
    ...(placeholders ? { placeholders: [{ slot: "index.hero", page: "index", section: "hero", note: "A photo of a recent sign install" }] } : {}),
  };
  h.fake = createFake(fx);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[`/activity/${JOB_VERIFIED}`]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return { user, calls: () => h.fake.calls };
}

describe("the finished site review", () => {
  it("two chips, the title, the placeholder row with what it should show, and the readiness line", async () => {
    start();
    expect(await screen.findByRole("heading", { level: 1, name: "Northlight Signs is ready for your approval" }, T)).toBeInTheDocument();
    expect(screen.getByText("Every check passed")).toBeInTheDocument();
    expect(screen.getByText("Not ready to launch")).toBeInTheDocument();
    const ph = screen.getByRole("region", { name: "Placeholder pictures" });
    expect(within(ph).getByText("Should show: A photo of a recent sign install")).toBeInTheDocument();
    expect(within(ph).getByLabelText("Add the picture for Home page: A photo of a recent sign install")).toHaveAttribute("type", "file");
    expect(within(ph).getByRole("status")).toHaveTextContent("Not ready to launch: 1 placeholder picture is still on the site.");
  });

  it("the owner knowingly ticks 'launch with placeholders': saved, and the chips agree", async () => {
    const t = start();
    await t.user.click(await screen.findByRole("checkbox", { name: /Launch with placeholders/ }, T));
    expect(t.calls()).toContainEqual(expect.objectContaining({ op: "insert", table: "plan_inputs", values: [expect.objectContaining({ key: "launch.placeholders_ok", value: "yes", waived: false })] }));
    expect(await screen.findByText("You chose to launch with 1 placeholder picture.", {}, T)).toBeInTheDocument();
    expect(screen.getByText("Ready to launch")).toBeInTheDocument();
  });

  it("Approve the site is the one primary, owner only, and stays off with the reason (no place to record it); nothing publishes", async () => {
    start();
    const approve = await screen.findByRole("button", { name: "Approve the site" }, T);
    expect(approve).toBeDisabled();
    expect(approve).toHaveAccessibleDescription(/can't record a site approval yet/);
    expect(screen.getAllByRole("button").filter((b) => b.classList.contains("primary"))).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /publish|deploy|launch the site/i })).toBeNull();
  });

  it("an admin sees no tick and no Approve; says who decides", async () => {
    start("admin");
    expect(await screen.findByText("Only an owner can choose to launch with placeholders.", {}, T)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Launch with placeholders/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve the site" })).toBeNull();
    expect(screen.getByText(/Only an owner approves the site/)).toBeInTheDocument();
  });

  it("no placeholders: says so, and is ready to launch once approved; the checks sit in Technical details", async () => {
    start("owner", false);
    expect(await screen.findByText("None. Every picture on the site came from the client.", {}, T)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Placeholder pictures" })).getByRole("status")).toHaveTextContent("Ready to launch once you approve.");
    const drawer = screen.getByText(/^Technical details: 2 checks/).closest("details")!;
    expect(drawer).toHaveTextContent("Page speed");
    expect(drawer).toHaveTextContent("Accessibility in the browser");
  });
});
