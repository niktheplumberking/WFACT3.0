#!/usr/bin/env node
/**
 * GitHub Actions entry point for Cockpit jobs (.github/workflows/cockpit-job.yml):
 *
 *   doppler run -- npx tsx src/run.ts <job-id>                 execute the job
 *   doppler run -- npx tsx src/run.ts <job-id> --mark-failed   crash safety net (workflow `if: failure()`)
 *
 * The ONLY input is the job id (validated as a UUID by the workflow and again here). Everything else
 * — the pasted request, plan ids, questions — is read from the jobs row the database already
 * validated, so no Cockpit text is ever interpolated into a shell.
 *
 * Wiring mirrors the CLIs exactly (same model routing, same traced clients, same stores); the one
 * difference is the artifact store: built pages go to the private `artifacts` Storage bucket, since
 * a runner's disk is gone when the job ends.
 */
import path from "node:path";
import { auditReaderFromEnv, auditSinkFromEnv, traceSinkFromEnv } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { resolveModelRoute } from "@wfact/hermes-lite/routing";
import { reviewerTraceHooks, traceModelClient } from "@wfact/hermes-lite/tracing";
import { capCheckForCurrentRun, capModelClient, loadSpendCaps, SupabaseSpendLedger } from "@wfact/hermes-lite/spendCaps";
import { stateReaderFromEnv } from "@wfact/hermes-lite/state";
import { modelClientFromEnv as hermesModelFromEnv } from "@wfact/hermes-lite/modelClient";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { createTrackABuilderAgent } from "@wfact/frontend-loop/trackA/agent";
import { createTrackBBuilderAgent } from "@wfact/frontend-loop/trackB/agent";
import { modelClientFromEnv } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { evaluatorModelClientFromEnv } from "@wfact/verification/modelClient";
import { modelIdentity } from "@wfact/verification/crossModel";
import { knownClientSlugs } from "@wfact/verification/paths";
import { ClaudeJsonClient } from "@wfact/planning/modelClient";
import { planStoreFromEnv } from "@wfact/planning/planStore";
import { SupabaseArtifactStore, SupabaseBrandAssetStore } from "@wfact/workflow/supabaseArtifacts";
import { createDocumentationAgent, createDocumentationObserver, FileMemoryStore, registerDocumentationAgent, SupabaseRunRecordReader } from "@wfact/documentation";
import { productionQaOptions } from "@wfact/rendered-qa/production";
import { TRACK_B_BUDGET } from "@wfact/rendered-qa/rendered";
import { SupabaseJobStore } from "./jobStore.js";
import { SupabasePlanInputStore } from "./inputStore.js";
import { handleJob, type HandlerDeps } from "./handlers.js";
import { SupabaseRequestLookup } from "./requestLookup.js";
import { askHermesGated } from "./hermesAsk.js";
import { providerProbes } from "./providerProbes.js";
import { readFileSync } from "node:fs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (Doppler prd config — docs/SECRETS.md)`);
  return v;
}

function ghRunUrl(): string | null {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : null;
}

function buildDeps(): HandlerDeps {
  const url = need("SUPABASE_URL");
  const serviceKey = need("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = need("ANTHROPIC_API_KEY");
  const { sink: audit } = auditSinkFromEnv();
  const { reader } = auditReaderFromEnv();
  const { sink: traces } = traceSinkFromEnv();
  const { store: planStore } = planStoreFromEnv();
  if (!audit || !reader || !traces || !planStore) throw new Error("audit/trace/plan stores need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  const actor = "job-runner";
  // MVP M6: every model call in a job first checks the spend caps (config/spend-caps.json; off until the amounts are agreed),
  // then is traced. The per-build cap reads the run's recorded spend, so retries and reopens all count against it.
  const caps = loadSpendCaps();
  const ledger = new SupabaseSpendLedger(url, serviceKey);
  const traced = <T extends object>(client: T, method: "complete" | "completeJson", who: string = actor): T =>
    capModelClient(traceModelClient(client, traces, who), method, caps, ledger);
  const reviewerHooks = reviewerTraceHooks(traces, actor, capCheckForCurrentRun(caps, ledger));

  const intakeModel = traced(new ClaudeJsonClient(resolveModelRoute("intake"), apiKey), "completeJson");
  const plannerModel = traced(new ClaudeJsonClient(resolveModelRoute("planner"), apiKey), "completeJson");
  // Step 4B M2: the direction step (niche, brand direction, track recommendation) between Intake and Planner.
  const directionModel = traced(new ClaudeJsonClient(resolveModelRoute("direction"), apiKey), "completeJson");

  const builder = modelClientFromEnv("builder");
  const reviewer = modelClientFromEnv("evaluator");
  // Step 7: the QA evaluator is chosen from config/evaluator.json in a different model family from the builder.
  const qa = evaluatorModelClientFromEnv(process.env, builder.client ? { avoid: modelIdentity(builder.client) } : {});
  if (!builder.client || !reviewer.client) throw new Error(`builder models unavailable: ${builder.reason ?? reviewer.reason}`);
  const qaModel = qa.client ? traced(qa.client, "complete") : null;
  const artifacts = new SupabaseArtifactStore(url, serviceKey);
  const slugs = knownClientSlugs();

  const qaAgent = createQaEvaluatorAgent(productionQaOptions({ evaluatorModel: qaModel, builderVendor: builder.client.name, builderModel: builder.client, reviewerHooks }));
  // Step 5: the Documentation agent records every finished stage. On a runner the memory file is written to the
  // checkout (gone when the job ends); the durable copy is the agent's documentation.entry row in audit_log, which
  // `npm run document` (packages/documentation) later writes into clients/<slug>/memory.md exactly as recorded.
  const registry = registerDocumentationAgent(createSeedRegistry());
  const stageObserver = createDocumentationObserver({
    agent: createDocumentationAgent({ records: new SupabaseRunRecordReader(url, serviceKey), memory: new FileMemoryStore(REPO_ROOT) }),
    registry,
    audit,
  });
  const workflow: HandlerDeps["workflow"] = {
    frontEndAgent: createFrontendBuilderAgent({
      builderModel: traced(builder.client, "complete"),
      evaluatorModel: traced(reviewer.client, "complete"),
    }),
    // Step 4B M1: claims gate + rendered QA + screenshot review, then the evaluator.
    qaAgent,
    registry,
    audit,
    reader,
    artifacts,
    knownClientSlugs: slugs,
    stageObserver,
    // 2026-10-14: the owner's uploaded logo (client-assets bucket) and the readiness probes run before any paid step.
    brandAssets: new SupabaseBrandAssetStore(url, serviceKey),
    providerProbes: providerProbes({
      anthropicKey: apiKey,
      anthropicModel: (JSON.parse(readFileSync(path.join(REPO_ROOT, "packages", "rendered-qa", "config", "reviewer.json"), "utf-8")) as { model: string }).model,
      agent37BaseUrl: process.env.AGENT37_BASE_URL,
      agent37Key: process.env.AGENT37_API_KEY,
    }),
  };

  return {
    planning: { intakeModel, plannerModel, directionModel, store: planStore, audit },
    planStore,
    // Step 4D: the details the owner added to the approved plan since approval (migration 0018).
    inputs: new SupabasePlanInputStore(url, serviceKey),
    // Build-quality Package 1: the client's request behind a plan stored before it was carried on the brief.
    requests: new SupabaseRequestLookup(url, serviceKey, planStore),
    // Step 4B M3: Track A plans are built by the Track A builder (Agent 37 fills the starter's content).
    trackAWorkflow: {
      ...workflow,
      frontEndAgent: createTrackABuilderAgent({
        builderModel: traced(builder.client, "complete"),
        evaluatorModel: traced(reviewer.client, "complete"),
      }),
    },
    // Step 4B M4: Track B plans: Agent 37 fills the Next.js starter's content, the static build runs with no
    // network and no secrets, and QA holds the site to the Track B budget (including the motion budget).
    trackBWorkflow: {
      ...workflow,
      frontEndAgent: createTrackBBuilderAgent({
        builderModel: traced(builder.client, "complete"),
        evaluatorModel: traced(reviewer.client, "complete"),
      }),
      qaAgent: createQaEvaluatorAgent(productionQaOptions({ evaluatorModel: qaModel, builderVendor: builder.client.name, builderModel: builder.client, budget: TRACK_B_BUDGET, reviewerHooks })),
    },
    workflow,
    readArtifact: (p) => artifacts.read(p),
    repoRoot: REPO_ROOT,
    qaAgent,
    audit,
    knownClientSlugs: slugs,
    ask: async (question) => {
      const { client } = hermesModelFromEnv();
      if (!client) throw new Error("ANTHROPIC_API_KEY missing for Hermes-lite");
      const { reader: stateReader } = stateReaderFromEnv();
      // Step 6: tool and model calls go through the controller's PermissionGate (hermesAsk.ts).
      return askHermesGated(question, { audit, stateReader, modelClient: traced(client, "complete", "hermes-lite") });
    },
  };
}

async function main() {
  const [jobId, flag] = process.argv.slice(2);
  if (!jobId || !UUID.test(jobId)) throw new Error(`usage: run.ts <job-uuid> [--mark-failed] (got ${JSON.stringify(jobId)})`);
  const store = new SupabaseJobStore(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"));
  const job = await store.get(jobId);
  if (!job) throw new Error(`job ${jobId} not found`);

  if (flag === "--mark-failed") {
    if (job.status === "succeeded" || job.status === "failed") return; // the runner already recorded an outcome
    await store.finish(jobId, { status: "failed", result: null, error: `runner crashed before recording a result — see ${ghRunUrl() ?? "the GitHub run log"}` });
    console.error(`job ${jobId} marked failed (crash safety net)`);
    return;
  }

  if (job.status !== "dispatched" && job.status !== "queued") {
    throw new Error(`job ${jobId} is "${job.status}" — refusing to run it twice`);
  }
  await store.markRunning(jobId, ghRunUrl());
  console.error(`running ${job.kind} job ${jobId}`);
  try {
    const outcome = await handleJob(job, buildDeps());
    await store.finish(jobId, { status: outcome.ok ? "succeeded" : "failed", result: outcome.result, error: outcome.reason });
    console.error(`job ${jobId}: ${outcome.ok ? "succeeded" : `failed — ${outcome.reason}`}`);
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    await store.finish(jobId, { status: "failed", result: null, error: message.slice(0, 2000) });
    console.error(`job ${jobId} failed with an exception: ${message}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("job runner crashed:", err);
  process.exitCode = 1;
});
