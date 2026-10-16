/**
 * The Costs room (Cockpit v2 phase 15, brief §6.11): sentence headline on the live cap period, last build cost, the
 * 7-day trend with a dashed cap line and a full text alternative, cost per client, "How the caps protect you" with a
 * stacked spend bar, and the per-model table only inside Technical details with estimates labelled. Owner-only (RLS).
 * Caps come from spend-caps.json (CAPS), never a typed figure. SYNTHETIC rows only (src/test/fake.ts plus rows made here).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, JOB_FAILED, OWNER_ID, RUN_FAILED } from "../test/fake";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";
import { CAPS, usd, usualRange, weekBlocks, type DayRow } from "../lib/costs";

const T = { timeout: 3000 };
const RUN_VERIFIED = "77777777-7777-4777-8777-777777777777";
const now = new Date();
const dayAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10);
const at = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
// Words that must never be on screen outside Technical details (brief §8).
const BANNED = /\b(plan|job|run id|track [AB]|entity|needs_input|token|sha|claude-|gpt-|gemini|hermes)\b/i;

const day = (o: Partial<DayRow>): DayRow => ({
  day: dayAgo(0), entity_slug: "bennett-co", provider: "anthropic", model: "claude-sonnet-5", calls: 1, input_tokens: 0, output_tokens: 0,
  priced_usd: 0, estimated_usd: 0, unpriced_calls: 0, unpriced_input_tokens: 0, unpriced_output_tokens: 0, ...o,
});
const run = (run_id: string, priced: number, lastMin: number) => ({
  run_id, entity_slug: "bennett-co", calls: 2, errors: 0, input_tokens: 1000, output_tokens: 100, priced_usd: priced, estimated_usd: 0,
  unpriced_calls: 0, unpriced_input_tokens: 0, unpriced_output_tokens: 0, first_call_at: at(lastMin + 5), last_call_at: at(lastMin),
});
const trace = (id: string, run_id: string | null, actor: string, cost: number, min: number, basis = "metered", model = "claude-sonnet-5") => ({
  id, occurred_at: at(min), run_id, actor, provider: "anthropic", model, entity_slug: "bennett-co", input_tokens: 1000, output_tokens: 100, cost_usd: cost, price_basis: basis, latency_ms: 1000, outcome: "success",
});

function fx(opts: { capStop?: boolean } = {}) {
  const f = fixtures();
  f.model_cost_by_day = [
    // the last 7 days: $1.00 at list price + $0.50 estimated = $1.50 counted by the cap
    day({ calls: 10, priced_usd: 1 }),
    day({ provider: "agent37", model: "hermes-agent", calls: 2, priced_usd: 0.5, estimated_usd: 0.5 }),
    // ten days ago: priced, so outside the cap's 7 days
    day({ day: dayAgo(10), calls: 4, priced_usd: 3 }),
    // three weeks ago: history (recorded before the site builder had a price), estimated from its tokens
    day({ day: dayAgo(20), provider: "agent37", model: "hermes-agent", calls: 5, input_tokens: 1_000_000, output_tokens: 100_000, unpriced_calls: 5, unpriced_input_tokens: 1_000_000, unpriced_output_tokens: 100_000 }),
  ] as unknown as Record<string, unknown>[];
  // newest first, as the view is ordered
  f.model_cost_by_run = [run(RUN_VERIFIED, 0.6, 30), run(RUN_FAILED, 0.9, 170)];
  f.model_traces = [
    trace("t1", RUN_VERIFIED, "agent:qa-evaluator", 0.2, 31),
    trace("t2", RUN_VERIFIED, "agent:front-end-builder", 0.4, 35),
    trace("t3", null, "hermes-lite", 0.004, 40),
    trace("t4", RUN_FAILED, "agent:front-end-builder", 0.9, 172, "estimated", "hermes-agent"),
  ];
  if (opts.capStop) {
    f.jobs = f.jobs.map((j) => (j.id === JOB_FAILED ? { ...j, error: "spend:$5.00 ceiling of $5.00 reached before render.design-review" } : j));
  }
  return f;
}

function start(role: Role = "owner", rows = fx()) {
  h.fake = createFake(rows);
  return render(
    <MemoryRouter initialEntries={["/costs"]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
}
const room = () => screen.getByRole("heading", { level: 1 }).closest(".costs") as HTMLElement;

describe("the Costs room", () => {
  it("leads with a sentence on the live cap period and the last build's cost", async () => {
    start();
    const h1 = await screen.findByRole("heading", { level: 1, name: /^Last 7 days:/ }, T);
    expect(h1).toHaveTextContent(`Last 7 days: $1.50 of your ${usd(CAPS.weeklyUsd!)} cap.`);
    expect(screen.getByText(/The last build cost \$0\.60\./)).toBeInTheDocument();
    expect(screen.getByText(/Part of this is an estimate: the site builder publishes no price\./)).toBeInTheDocument();
    // two builds are not enough to say what builds usually cost
    expect(screen.queryByText(/Most builds cost between/)).not.toBeInTheDocument();
  });

  it("draws six 7-day bars with a dashed cap line, and says every figure in a text alternative", async () => {
    start();
    const trend = await screen.findByRole("img", { name: /^Spend per 7 days:/ }, T);
    expect(trend.getAttribute("aria-label")).toContain("the last 7 days $1.50");
    expect(trend.getAttribute("aria-label")).toContain(`The cap is ${usd(CAPS.weeklyUsd!)} per 7 days.`);
    expect(trend.getAttribute("aria-label")).toContain("Includes estimates.");
    expect(trend.querySelectorAll(".trend-bar")).toHaveLength(6);
    expect(trend.querySelector(".trend-cap")).not.toBeNull();
  });

  it("splits the last 7 days by client, through the build that spent it", async () => {
    start();
    const list = within(await screen.findByRole("region", { name: "Cost per client, last 7 days" }, T));
    const rows = list.getAllByRole("listitem").map((li) => li.textContent);
    // both Northlight builds spent inside the window; the failed one was priced as an estimate
    expect(rows).toEqual(["Northlight Signs$1.50 estimate", "Not tied to a clientunder $0.01"]);
  });

  it("shows how the caps protect you, from the live caps and a real build", async () => {
    start();
    const caps = within(await screen.findByRole("region", { name: "How the caps protect you" }, T));
    expect(caps.getByText(new RegExp(`Each build stops itself at \\$${CAPS.perBuildUsd!.toFixed(2)}\\.`))).toBeInTheDocument();
    expect(caps.getByText(/refuses the call once a cap is reached/)).toBeInTheDocument();
    expect(caps.getByText("No build has reached a cap yet. The picture shows the last build against its cap.")).toBeInTheDocument();
    const bar = caps.getByRole("img");
    expect(bar).toHaveAccessibleName(`Northlight Signs's last build: writing and fixing the site $0.40, checks and reviews $0.20. $0.60 of the ${usd(CAPS.perBuildUsd!)} per-build cap.`);
    expect(bar.querySelectorAll(".caps-seg")).toHaveLength(2);
    // nothing behind a "Change the caps" button, so there is none
    expect(caps.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses the build a cap stopped as the example when there is one", async () => {
    start("owner", fx({ capStop: true }));
    const caps = within(await screen.findByRole("region", { name: "How the caps protect you" }, T));
    expect(caps.getByText("The picture shows the last build a cap stopped.")).toBeInTheDocument();
    expect(caps.getByRole("img")).toHaveAccessibleName(/^The last build a cap stopped: writing and fixing the site \$0\.90\./);
  });

  it("keeps the per-model table inside Technical details, with estimates labelled", async () => {
    start();
    await screen.findByRole("heading", { level: 1, name: /^Last 7 days:/ }, T);
    const tech = room().querySelector("details.tech") as HTMLElement;
    expect(within(tech).getByText("Technical details: cost by AI model")).toBeInTheDocument();
    expect(within(tech).getByRole("cell", { name: "hermes-agent" })).toBeInTheDocument();
    expect(within(tech).getAllByText(/\(estimated\)/).length).toBeGreaterThan(0);
    expect(within(tech).getByText(/The site builder publishes no price, so its cost is an estimate/)).toBeInTheDocument();
    // outside Technical details: no model names or engineering words
    const clone = room().cloneNode(true) as HTMLElement;
    clone.querySelectorAll("details").forEach((d) => d.remove());
    expect(clone.textContent).not.toMatch(BANNED);
  });

  it("has no primary button and no deploy or publish control", async () => {
    start();
    await screen.findByRole("heading", { level: 1, name: /^Last 7 days:/ }, T);
    expect(room().querySelectorAll(".btn.primary")).toHaveLength(0);
    const controls = [...room().querySelectorAll("button, a, [role=button]")].map((e) => e.textContent ?? "");
    expect(controls.filter((t) => /deploy|publish/i.test(t))).toEqual([]);
  });

  it("is for owners only: admins and project managers see a plain notice and no figures", async () => {
    for (const role of ["admin", "pm"] as Role[]) {
      const r = start(role);
      expect(await screen.findByText("Costs are for owners only.", {}, T)).toBeInTheDocument();
      expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
      r.unmount();
    }
  });

  it("says so when nothing has been spent yet", async () => {
    const f = fx();
    f.model_cost_by_day = [];
    f.model_cost_by_run = [];
    f.model_traces = [];
    start("owner", f);
    expect(await screen.findByText("Nothing has been spent yet.", {}, T)).toBeInTheDocument();
  });

  it("shows the database's answer when the read fails", async () => {
    h.fake = createFake(fx());
    const from = h.fake.client.from;
    const failing = () => {
      const api = { select: () => api, eq: () => api, in: () => api, order: () => api, limit: () => api, then: (resolve: (r: unknown) => void) => resolve({ data: null, error: { message: "permission denied for view model_cost_by_day" } }) };
      return api;
    };
    (h.fake.client as { from: unknown }).from = (t: string) => (t === "model_cost_by_day" ? failing() : from(t));
    render(
      <MemoryRouter initialEntries={["/costs"]}>
        <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role: "owner", fullName: "Test Owner" }} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Couldn't load the costs.", {}, T)).toBeInTheDocument();
    expect(screen.getByText(/permission denied for view model_cost_by_day/)).toBeInTheDocument();
  });
});

describe("the figures behind it", () => {
  it("says what builds usually cost only with three or more to go on (the middle half)", () => {
    expect(usualRange([0.5, 0.9])).toBeNull();
    expect(usualRange([0.5, 0.6, 0.7, 0.8, 2.4])).toEqual([0.6, 0.8]);
  });
  it("cuts the trend into 7-day blocks ending today, oldest first", () => {
    const d = new Date("2026-10-16T12:00:00Z");
    const blocks = weekBlocks([day({ day: "2026-10-16", priced_usd: 1, calls: 1 }), day({ day: "2026-10-09", priced_usd: 2, calls: 1 })], d);
    expect(blocks.map((b) => [b.from, b.to])).toEqual([
      ["2026-09-05", "2026-09-11"],
      ["2026-09-12", "2026-09-18"],
      ["2026-09-19", "2026-09-25"],
      ["2026-09-26", "2026-10-02"],
      ["2026-10-03", "2026-10-09"],
      ["2026-10-10", "2026-10-16"],
    ]);
    expect(blocks.map((b) => b.spend.metered)).toEqual([0, 0, 0, 0, 2, 1]);
  });
  it("says a tiny real figure as under a cent, never $0.00", () => {
    expect(usd(0.004)).toBe("under $0.01");
    expect(usd(0)).toBe("$0.00");
    expect(usd(1.5)).toBe("$1.50");
  });
});
