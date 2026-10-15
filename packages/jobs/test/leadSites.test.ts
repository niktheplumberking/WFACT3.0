/**
 * Step 25 / MVP M4: the runner wires the client's lead form. The lead_sites lookup (fake fetch), the brief (the lead form
 * comes only from the lookup), and end to end: a Track A build job with a lead site renders a form wired to submit-lead that
 * passes launch.form-connected; without one the form stays "not connected", the run says why, and the launch check fails.
 * Everything is synthetic (Northlight Signs, the SYNTHETIC Summit Line content, a made-up project ref and key).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { createTrackABuilderAgent } from "@wfact/frontend-loop/trackA/agent";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvalMock } from "@wfact/verification/modelClient";
import { formConnectedCheck } from "@wfact/verification/checks/registryChecks";
import { MockJsonClient } from "@wfact/planning/modelClient";
import { MemoryPlanStore } from "@wfact/planning/planStore";
import { MemoryArtifactStore } from "@wfact/workflow";
import { briefForBuild, handleJob, type HandlerDeps } from "../src/handlers.js";
import { SupabaseLeadSiteLookup, type LeadSiteLookup } from "../src/leadSites.js";
import type { Job } from "../src/jobStore.js";

const KEY = "0b7d3c1e-2a4f-4e6b-9c8d-1f2e3a4b5c6d";
const URL_BASE = "https://abcdefghijklmnopqrst.supabase.co";
const LEAD = { endpoint: `${URL_BASE}/functions/v1/submit-lead`, siteKey: KEY };

function fakeFetch(status: number, rows: unknown[], seen: string[] = []): typeof fetch {
  return (async (url: string | URL | Request) => {
    seen.push(String(url));
    return new Response(JSON.stringify(rows), { status });
  }) as typeof fetch;
}

test("the lookup reads the client's active lead site and returns the submit-lead endpoint and key", async () => {
  const seen: string[] = [];
  const lookup = new SupabaseLeadSiteLookup(`${URL_BASE}/`, "service-key-placeholder", fakeFetch(200, [{ site_key: KEY }], seen));
  assert.deepEqual(await lookup.leadFormFor("northlight-signs"), LEAD);
  assert.equal(seen[0], `${URL_BASE}/rest/v1/lead_sites?client_slug=eq.northlight-signs&active=is.true&select=site_key&limit=1`);
  assert.equal(await new SupabaseLeadSiteLookup(URL_BASE, "k", fakeFetch(200, [])).leadFormFor("northlight-signs"), null);
  await assert.rejects(() => new SupabaseLeadSiteLookup(URL_BASE, "k", fakeFetch(500, [])).leadFormFor("northlight-signs"), /HTTP 500/);
  await assert.rejects(() => new SupabaseLeadSiteLookup(URL_BASE, "k", fakeFetch(200, [{ site_key: "x" }])).leadFormFor("northlight-signs"), /no readable site_key/);
  const none: string[] = [];
  assert.equal(await new SupabaseLeadSiteLookup(URL_BASE, "k", fakeFetch(200, [], none)).leadFormFor("x&select=*"), null);
  assert.equal(none.length, 0, "a malformed slug is never sent");
});

test("briefForBuild: the lead form comes only from the runner's lookup; one carried on a stored brief is dropped", () => {
  const brief = { clientSlug: "northlight-signs", entitySlug: "dreamsign", projectName: "x", goal: "x", requiredSections: [], brandNotes: "x", source: "intake-planner" as const };
  const intake = { entitySlug: "dreamsign", leadType: "new_website", requestSource: "cockpit", clientName: "Northlight Signs" };
  assert.deepEqual(briefForBuild({ brief, intake }, [], null, LEAD).leadForm, LEAD);
  assert.equal("leadForm" in briefForBuild({ brief: { ...brief, leadForm: LEAD }, intake }), false);
});

const intakeOut = {
  entitySlug: "dreamsign", leadType: "new_website", clientName: "Northlight Signs", projectName: "Northlight homepage",
  goal: "Explain services.", brandNotes: "Calm.", requestedSections: ["services", "process", "contact"], ambiguities: [],
};
const planOut = {
  templateId: "clean-agency", templateRationale: "Trust-first.", projectName: "Northlight homepage", goal: "Explain services.",
  brandNotes: "Calm.", requiredSections: ["hero"], risks: [], openQuestions: [],
  tasks: [
    { role: "front-end-builder", stage: "4_homepage_build", title: "Build" },
    { role: "qa-evaluator", stage: "7_qa_security", title: "Verify" },
  ],
};
const CONTENT = readFileSync(path.join(import.meta.dirname, "..", "..", "frontend-loop", "test", "fixtures", "track-a", "summit-line.content.json"), "utf-8");
const job = (kind: Job["kind"], params: Record<string, unknown>): Job => ({ id: crypto.randomUUID(), kind, params, status: "dispatched", createdBy: crypto.randomUUID() });

async function trackABuild(leadSites?: LeadSiteLookup) {
  const audit = new InMemoryAuditSink();
  const planStore = new MemoryPlanStore();
  const artifacts = new MemoryArtifactStore();
  const workflow = {
    frontEndAgent: createFrontendBuilderAgent({ builderModel: new BuilderMock(() => ""), evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: new EvalMock(() => "VERDICT: APPROVED") }),
    registry: createSeedRegistry(),
    audit,
    reader: audit,
    artifacts,
    knownClientSlugs: ["dreamsign-pilot", "northlight-signs", "bennett-co"],
    maxQaRevisions: 1,
  };
  const d: HandlerDeps = {
    planning: { intakeModel: new MockJsonClient(() => intakeOut), plannerModel: new MockJsonClient(() => planOut), store: planStore, audit },
    planStore,
    workflow,
    trackAWorkflow: {
      ...workflow,
      frontEndAgent: createTrackABuilderAgent({ builderModel: new BuilderMock(() => CONTENT), evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
    },
    readArtifact: async (p) => artifacts.files.get(p) ?? null,
    repoRoot: path.join(import.meta.dirname, "..", "..", ".."),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: new EvalMock(() => "VERDICT: APPROVED") }),
    audit,
    knownClientSlugs: ["dreamsign-pilot", "bennett-co"],
    ask: async () => ({ answer: "", sourcesUsed: [], needsHuman: false, escalationReason: null }),
    ...(leadSites ? { leadSites } : {}),
  };
  const intake = await handleJob(job("intake", { text: "Hi DreamSign, Northlight Signs needs a homepage." }), d);
  planStore.decide(intake.result.planId as string, "approved", null, "A");
  const out = await handleJob(job("build_plan", { planId: intake.result.planId }), d);
  assert.equal(out.ok, true, out.reason ?? JSON.stringify(out.result.qaIssues));
  const dir = "clients/northlight-signs/sites/track-a/";
  const pages = ["index.html", "services.html", "faq.html", "contact.html"];
  const files = Object.fromEntries(pages.map((p) => [p, artifacts.files.get(dir + p) as string]));
  const launch = formConnectedCheck.run({ html: files["index.html"]!, clientSlug: "northlight-signs", requiredSections: [], otherClientSlugs: [], site: { files, pages } });
  return { out, files, launch };
}

test("end to end: a Track A build for a client with a lead site posts its form to submit-lead and passes the launch check", async () => {
  const asked: string[] = [];
  const { out, files, launch } = await trackABuild({ leadFormFor: async (slug) => (asked.push(slug), LEAD) });
  assert.deepEqual(asked, ["northlight-signs"]);
  assert.equal(out.result.leadForm, "connected");
  assert.ok(files["contact.html"]!.includes(`action="${LEAD.endpoint}" method="post"`));
  assert.ok(files["contact.html"]!.includes(`name="site_key" value="${KEY}"`));
  assert.equal(launch.passed, true, launch.details.join("\n"));
});

test("end to end: without a lead site the form stays 'not connected', the run says why, and the launch check fails it", async () => {
  const { out, files, launch } = await trackABuild({ leadFormFor: async () => null });
  assert.equal(out.result.leadForm, "not connected (no active lead site for this client)");
  assert.match(files["contact.html"]!, /data-unconnected=/);
  assert.equal(launch.passed, false);
  assert.match(launch.details[0]!, /contact\.html: form #request has no action/);

  const failed = await trackABuild({ leadFormFor: async () => Promise.reject(new Error("lead_sites read failed (HTTP 503)")) });
  assert.equal(failed.out.result.leadForm, "not connected (lead site lookup failed: lead_sites read failed (HTTP 503))");
  assert.equal(failed.launch.passed, false);
});
