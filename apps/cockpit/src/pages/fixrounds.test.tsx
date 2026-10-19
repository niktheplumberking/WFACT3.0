/**
 * Fix rounds as an Activity filter (Cockpit v2, Package 4 R4, Huraira's option b): `/activity/fixes` and `/runs` open the
 * Activity room on "Fix rounds"; each logged round is one row in plain words (lib/activity.ts roundLines, who found and
 * fixed it through lib/phrases.ts roundActor), never the raw model or vendor the row records; project managers cannot reach
 * it (Activity is owner/admin). SYNTHETIC rows only, shaped like the live correction_rounds rows of 2026-10-20.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
import { roundActor } from "../lib/phrases";

const T = { timeout: 3000 };
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const BANNED = /\b(plan|plans|job|jobs|run|runs|track [AB]|entity|needs_input|tokens?|sha|github|workflow|claude|gpt-\S*|gemini|hermes|agent ?\d+|evaluator|frontend-loop)\b/i;

function start(path: string, role: Role = "owner") {
  const f = fixtures();
  f.correction_rounds = [
    { id: "cr-1", round_number: 1, stage: "4_homepage_build", flagged_by: "evaluator (claude)", issue: "[render.perf] LCP 4.1s on the Home page.", fixed_by: "frontend-loop (builder: agent37)", created_at: ago(90), projects: { name: "Harbor bakery site", clients: { name: "Harbor Street Bakery" } } },
    { id: "cr-2", round_number: 2, stage: "4_homepage_build", flagged_by: "evaluator (claude)", issue: "Body text too light on the menu.", fixed_by: null, created_at: ago(60), projects: { name: "Harbor bakery site", clients: { name: "Harbor Street Bakery" } } },
  ];
  h.fake = createFake(f);
  render(
    <MemoryRouter initialEntries={[path]}>
      <SignedIn me={{ userId: OWNER_ID, email: "someone@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
}

const shown = () => screen.queryAllByRole("listitem").filter((li) => li.classList.contains("activity-row"));

describe("fix rounds in the Activity room", () => {
  it("/activity/fixes opens Activity on the Fix rounds filter, one plain row per round", async () => {
    start("/activity/fixes");
    expect(await screen.findByRole("heading", { level: 1, name: "Activity" }, T)).toBeInTheDocument();
    const pills = within(screen.getByRole("group", { name: "Type" })).getAllByRole("button");
    expect(pills.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent)).toEqual(["Fix rounds"]);
    await screen.findByText(/Round 2 of fixes/, {}, T);
    expect(shown()).toHaveLength(2);
    expect(shown()[0]).toHaveTextContent("Round 2 of fixes, site build: Body text too light on the menu. The independent reviewer found it; not marked fixed yet.");
    expect(shown()[1]).toHaveTextContent(/Round 1 of fixes, site build: .+ The independent reviewer found it; the builder fixed it\./);
    expect(within(shown()[0]!).getByText("Harbor Street Bakery")).toBeInTheDocument();
    expect(screen.getByRole("main").textContent).not.toMatch(BANNED);
  });

  it("/runs lands on the same filter", async () => {
    start("/runs");
    expect(await screen.findByRole("button", { name: "Fix rounds" }, T)).toHaveAttribute("aria-pressed", "true");
  });

  it("a project manager cannot reach it: Activity is for owners and admins", async () => {
    start("/activity/fixes", "pm");
    expect(await screen.findByText("Activity is for owners and admins.", {}, T)).toBeInTheDocument();
    expect(screen.queryByText(/Round \d of fixes/)).toBeNull();
  });
});

describe("who found or fixed a round, in plain words", () => {
  it("names the role, never the model or vendor, and leaves out what it does not know", () => {
    expect(roundActor("evaluator (claude)")).toBe("the independent reviewer");
    expect(roundActor("frontend-loop (builder: agent37)")).toBe("the builder");
    expect(roundActor("rendered-qa")).toBe("the automatic checks");
    expect(roundActor("gpt-5 (openai)")).toBeNull();
    expect(roundActor(null)).toBeNull();
  });
});
