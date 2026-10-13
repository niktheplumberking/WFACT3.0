import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runContext } from "@wfact/audit";
import { capModelClient, checkSpendCaps, loadSpendCaps, SpendCapExceededError, SupabaseSpendLedger, type SpendCaps, type SpendLedger } from "../src/spendCaps.js";

const caps = (perBuildUsd: number | null, weeklyUsd: number | null): SpendCaps => ({ perBuildUsd, weeklyUsd, version: "t", source: "config" });
const ledger = (build: number, week: number): SpendLedger & { reads: number } => {
  const l = { reads: 0, buildSpentUsd: async () => (l.reads++, build), weekSpentUsd: async () => (l.reads++, week) };
  return l;
};
const RUN = "0cfc6675-c312-47b1-8c51-a48c62202fa6";
const inRun = <T>(fn: () => Promise<T>) => runContext.run({ runId: RUN, taskId: null, actor: "agent:front-end-builder", entitySlug: "bennett-co" }, fn);

test("the shipped caps are the amounts Nick approved on 2026-10-13 (D5): $5 per build, $20 per 7 days", () => {
  const c = loadSpendCaps({});
  assert.equal(c.perBuildUsd, 5);
  assert.equal(c.weeklyUsd, 20);
  assert.equal(c.source, "config");
});

test("env overrides a cap for one run; a bad value is refused", () => {
  assert.equal(loadSpendCaps({ WFACT_CAP_PER_BUILD_USD: "5" }).perBuildUsd, 5);
  assert.equal(loadSpendCaps({ WFACT_CAP_PER_BUILD_USD: "5" }).source, "env");
  assert.throws(() => loadSpendCaps({ WFACT_CAP_WEEKLY_USD: "-1" }), /non-negative/);
  assert.equal(loadSpendCaps({ WFACT_CAP_PER_BUILD_USD: " " }).source, "config", "a blank variable is ignored, not read as $0");
  const dir = mkdtempSync(path.join(tmpdir(), "caps-"));
  const f = path.join(dir, "caps.json");
  writeFileSync(f, JSON.stringify({ version: "9", perBuildUsd: 5, weeklyUsd: 20 }));
  assert.deepEqual(loadSpendCaps({}, f), { perBuildUsd: 5, weeklyUsd: 20, version: "9", source: "config" });
});

test("M6 acceptance: a seeded over-cap build is refused before the model is called", async () => {
  let called = 0;
  const client = { name: "agent37", complete: async () => (called++, "ok") };
  const capped = capModelClient(client, "complete", caps(5, null), ledger(5.01, 0));
  await assert.rejects(inRun(() => capped.complete()), (e: unknown) => e instanceof SpendCapExceededError && e.cap === "build" && /\$5\.01 of its \$5\.00 cap/.test(e.message));
  assert.equal(called, 0, "no money spent once the cap is reached");
});

test("under the cap the call runs; the weekly cap refuses across all builds", async () => {
  const client = { name: "claude", complete: async () => "ok" };
  assert.equal(await inRun(() => capModelClient(client, "complete", caps(5, 20), ledger(4.99, 19.99)).complete()), "ok");
  await assert.rejects(inRun(() => capModelClient(client, "complete", caps(5, 20), ledger(0.1, 20)).complete()), (e: unknown) => e instanceof SpendCapExceededError && e.cap === "weekly");
});

test("caps off: the client is returned untouched and no spend is read", async () => {
  const client = { name: "claude", complete: async () => "ok" };
  const l = ledger(999, 999);
  assert.equal(capModelClient(client, "complete", caps(null, null), l), client);
  await checkSpendCaps(caps(null, null), l, RUN);
  assert.equal(l.reads, 0);
});

test("the per-build cap needs a run id; outside a run only the weekly cap applies", async () => {
  await checkSpendCaps(caps(1, null), ledger(50, 0), null);
  await assert.rejects(checkSpendCaps(caps(1, 10), ledger(50, 10), null), /Weekly/);
});

test("SupabaseSpendLedger sums priced_usd from the migration 0020 views and fails closed", async () => {
  const urls: string[] = [];
  const ok = new SupabaseSpendLedger("https://x.supabase.co/", "k", (async (u: string) => {
    urls.push(u);
    return new Response(JSON.stringify([{ priced_usd: "1.25" }, { priced_usd: 0.5 }]), { status: 200 });
  }) as typeof fetch, () => new Date("2026-10-13T12:00:00Z"));
  assert.equal(await ok.buildSpentUsd(RUN), 1.75);
  assert.equal(await ok.weekSpentUsd(), 1.75);
  assert.match(urls[0]!, /model_cost_by_run\?run_id=eq\.0cfc6675/);
  assert.match(urls[1]!, /model_cost_by_day\?day=gte\.2026-10-07/);
  const down = new SupabaseSpendLedger("https://x", "k", (async () => new Response("no", { status: 503 })) as typeof fetch);
  await assert.rejects(down.weekSpentUsd(), /could not read recorded spend/);
});
