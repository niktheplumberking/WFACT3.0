#!/usr/bin/env node
/**
 * Step 4B M2 evaluation of the direction step against the labelled SYNTHETIC cases in
 * test/fixtures/direction/cases.json:  doppler run -- npm run eval-direction
 *
 * Live models (the routed intake + direction slots), no database writes, no audit rows. Each case gets
 * fresh clients so its cost is measured on its own. Writes results.json and RESULTS.md next to the cases.
 * Scoring: strict = recommendation equals expectTrack (null = withheld); lenient = equals expectTrack or
 * one of alsoAcceptable. Niche is scored separately.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createSeedRegistry, runAgent } from "@wfact/agent-runtime";
import { costForModel, resolveModelRoute } from "@wfact/hermes-lite/routing";
import { ClaudeJsonClient } from "./modelClient.js";
import { createIntakeAgent, INTAKE_DEFINITION, INTAKE_ROLE } from "./intake.js";
import { createDirectionAgent, DIRECTION_DEFINITION, DIRECTION_ROLE, DIRECTION_TAXONOMY } from "./direction.js";

interface Case {
  id: string;
  niche: string;
  expectTrack: "A" | "B" | null;
  alsoAcceptable: ("A" | "B" | null)[];
  why: string;
  text: string;
}

const dir = path.resolve(import.meta.dirname, "..", "test", "fixtures", "direction");
const { version, cases } = JSON.parse(readFileSync(path.join(dir, "cases.json"), "utf-8")) as { version: string; cases: Case[] };

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (run under doppler run --)");
  const intakeRoute = resolveModelRoute("intake");
  const directionRoute = resolveModelRoute("direction");
  const registry = createSeedRegistry();
  registry.register(INTAKE_DEFINITION);
  registry.register(DIRECTION_DEFINITION);
  const started = new Date();
  const rows: Record<string, unknown>[] = [];

  for (const c of cases) {
    const t0 = Date.now();
    const intakeModel = new ClaudeJsonClient(intakeRoute, apiKey);
    const directionModel = new ClaudeJsonClient(directionRoute, apiKey);
    const intake = await runAgent(createIntakeAgent({ model: intakeModel }), { taskId: crypto.randomUUID(), role: INTAKE_ROLE, input: c.text }, { registry });
    let row: Record<string, unknown> = { id: c.id, expectedNiche: c.niche, expectTrack: c.expectTrack, alsoAcceptable: c.alsoAcceptable, intakeStatus: intake.status };
    if (intake.output) {
      const d = await runAgent(createDirectionAgent({ model: directionModel }), { taskId: crypto.randomUUID(), role: DIRECTION_ROLE, input: { intake: intake.output, rawText: c.text } }, { registry });
      const out = d.output;
      const got = out?.recommendation.track ?? null;
      row = {
        ...row,
        directionStatus: d.status,
        directionReason: d.reason,
        niche: out?.niche ?? null,
        nicheOk: out?.niche === c.niche,
        track: got,
        modelTrack: out?.recommendation.modelTrack ?? null,
        confidence: out?.recommendation.confidence ?? null,
        withheldReason: out?.recommendation.withheldReason ?? null,
        reasons: out?.recommendation.reasons ?? [],
        strict: out ? got === c.expectTrack : false,
        lenient: out ? got === c.expectTrack || c.alsoAcceptable.includes(got) : false,
        kept: out ? out.requirements.length + out.constraints.length + out.brandDirection.length : 0,
        unsupported: out?.unsupported ?? [],
      };
    }
    const cost = (m: ClaudeJsonClient) => costForModel(m.route.model, m.totalUsage).costUsd ?? 0;
    row.costUsd = Number((cost(intakeModel) + cost(directionModel)).toFixed(4));
    row.directionTokens = { ...directionModel.totalUsage };
    row.ms = Date.now() - t0;
    rows.push(row);
    console.error(`${c.id}: expected ${c.expectTrack ?? "none"}, got ${(row.track as string | null) ?? "none"}${row.withheldReason ? ` (${row.withheldReason})` : ""}, niche ${String(row.niche)} ${row.nicheOk ? "ok" : "MISS"}, $${row.costUsd}`);
  }

  const n = rows.length;
  const count = (k: string) => rows.filter((r) => r[k] === true).length;
  const total = rows.reduce((s, r) => s + (r.costUsd as number), 0);
  const summary = {
    casesVersion: version,
    taxonomyVersion: DIRECTION_TAXONOMY.version,
    intakeModel: intakeRoute.model,
    directionModel: directionRoute.model,
    startedAt: started.toISOString(),
    cases: n,
    strict: count("strict"),
    lenient: count("lenient"),
    niche: count("nicheOk"),
    totalCostUsd: Number(total.toFixed(4)),
  };
  writeFileSync(path.join(dir, "results.json"), JSON.stringify({ summary, rows }, null, 2));

  const yesno = (b: unknown) => (b ? "yes" : "**no**");
  const md = [
    "# Direction step evaluation (Step 4B M2)",
    "",
    `Run ${summary.startedAt} by \`npm run eval-direction\`: ${n} labelled SYNTHETIC cases (cases v${version}, taxonomy v${summary.taxonomyVersion}),`,
    `Intake \`${summary.intakeModel}\` + Direction \`${summary.directionModel}\`, live, no database writes. Labels were written before the first run.`,
    "",
    `**Track recommendation: ${summary.strict}/${n} strict, ${summary.lenient}/${n} lenient. Niche: ${summary.niche}/${n}. Total cost $${summary.totalCostUsd.toFixed(4)}.**`,
    "",
    "| Case | Expected | Got | Strict | Lenient | Confidence | Niche (expected → got) | Withheld because | Dropped points | Cost |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) =>
      `| ${r.id} | ${r.expectTrack ?? "none"}${(r.alsoAcceptable as unknown[]).length ? ` (also ${(r.alsoAcceptable as (string | null)[]).map((x) => x ?? "none").join("/")})` : ""} | ${r.track ?? "none"} | ${yesno(r.strict)} | ${yesno(r.lenient)} | ${r.confidence === null || r.confidence === undefined ? "n/a" : (r.confidence as number).toFixed(2)} | ${r.expectedNiche} → ${r.niche ?? "n/a"}${r.nicheOk ? "" : " **(miss)**"} | ${r.withheldReason ?? ""} | ${(r.unsupported as string[] | undefined)?.length ?? 0} | $${(r.costUsd as number).toFixed(4)} |`,
    ),
    "",
    "Every miss is listed above; nothing is averaged away. Intake status per case is in results.json (entity ambiguity is expected for",
    "requests that name no WFACT entity; the direction step was still run on Intake's output so it could be scored).",
  ].join("\n");
  writeFileSync(path.join(dir, "RESULTS.md"), md + "\n");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("direction evaluation crashed:", err);
  process.exitCode = 1;
});
