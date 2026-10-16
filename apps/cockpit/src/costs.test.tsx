/**
 * MVP M6 cost arithmetic: list price and estimates kept apart, history priced from real tokens, unpriced calls counted.
 * The Costs room itself is tested in src/pages/costs.test.tsx. SYNTHETIC rows.
 */
import { describe, expect, it, vi } from "vitest";

// lib/costs imports the Supabase client; these tests never call it.
vi.mock("./supabaseClient", () => ({ supabase: {} }));
import { callCost, priceTokens, runSpend, sumDays, total, type DayRow, type RunRow } from "./lib/costs";

const today = new Date().toISOString().slice(0, 10);
const RUN = "9bb96676-1630-4b15-81aa-3e0b1c58656e";

const day = (o: Partial<DayRow>): DayRow => ({
  day: today, entity_slug: "bennett-co", provider: "anthropic", model: "claude-sonnet-5", calls: 1, input_tokens: 0, output_tokens: 0,
  priced_usd: 0, estimated_usd: 0, unpriced_calls: 0, unpriced_input_tokens: 0, unpriced_output_tokens: 0, ...o,
});
const days: DayRow[] = [
  // Claude at list price: $1.00.
  day({ calls: 10, input_tokens: 250_000, output_tokens: 50_000, priced_usd: 1 }),
  // Agent 37 history (unpriced before M6): 1M in / 100k out at the $3/$15 estimate = $4.50.
  day({ provider: "agent37", model: "hermes-agent", calls: 5, input_tokens: 1_000_000, output_tokens: 100_000, unpriced_calls: 5, unpriced_input_tokens: 1_000_000, unpriced_output_tokens: 100_000 }),
  // Agent 37 after M6: recorded as an estimate, $0.50.
  day({ provider: "agent37", model: "hermes-agent", calls: 2, input_tokens: 100_000, output_tokens: 13_333, priced_usd: 0.5, estimated_usd: 0.5 }),
];
const run: RunRow = {
  run_id: RUN, entity_slug: "dreamsign", calls: 3, errors: 0, input_tokens: 681_787, output_tokens: 41_500, priced_usd: 0, estimated_usd: 0,
  unpriced_calls: 3, unpriced_input_tokens: 681_787, unpriced_output_tokens: 41_500, first_call_at: "2026-09-28T17:06:47Z", last_call_at: "2026-09-28T17:09:31Z",
};

describe("cost arithmetic", () => {
  it("prices Agent 37 history from its real tokens, keeps list price and estimates apart", () => {
    const s = sumDays(days);
    expect(s.metered).toBeCloseTo(1);
    expect(s.estimated).toBeCloseTo(0.5);
    expect(s.history).toBeCloseTo(4.5);
    expect(total(s)).toBeCloseTo(6);
    expect(s.unknownCalls).toBe(0);
  });
  it("a model with no price at all is counted, never $0", () => {
    const s = sumDays([day({ model: "mystery", calls: 2, unpriced_calls: 2, unpriced_input_tokens: 10, unpriced_output_tokens: 10 })]);
    expect(s.unknownCalls).toBe(2);
    expect(total(s)).toBe(0);
    expect(priceTokens("mystery", 1, 1)).toBeNull();
  });
  it("the DreamSign outlier run is about $2.67 at the estimate", () => {
    expect(total(runSpend(run))).toBeCloseTo(2.668, 2);
  });
  it("a call's cost says how sure it is", () => {
    const base = { id: "1", occurred_at: today, run_id: null, actor: "a", provider: "agent37", entity_slug: null, latency_ms: 1, outcome: "success" };
    expect(callCost({ ...base, model: "hermes-agent", input_tokens: 1e6, output_tokens: 0, cost_usd: null, price_basis: "unpriced" })).toEqual({ usd: 3, basis: "history" });
    expect(callCost({ ...base, model: "claude-sonnet-5", input_tokens: 1, output_tokens: 1, cost_usd: "0.25", price_basis: "metered" })).toEqual({ usd: 0.25, basis: "metered" });
  });
});
