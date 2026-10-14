/**
 * Readiness check and "continue from a chosen step" (2026-10-14). The readiness check runs before any paid step, on a
 * start and on every continue; a continue can re-check the saved site (qa), send the last findings straight to the
 * builder (revise) or build again (rebuild). Fixtures are the same SYNTHETIC DreamSign pages as buildAndVerify.test.ts.
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink, type AuditEvent } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { clearProvidedLogoAssets, inspectLogo, logoAssetFor } from "@wfact/frontend-loop/brandAsset";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvaluatorMock } from "@wfact/verification/modelClient";
import {
  buildAndVerify,
  lastQaFindings,
  resumeBuildAndVerify,
  MemoryArtifactStore,
  type PreflightCheck,
  type WorkflowDeps,
} from "../src/buildAndVerify.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const FIXTURES = path.join(ROOT, "packages", "verification", "test", "fixtures");
const BROKEN = readFileSync(path.join(FIXTURES, "broken.html"), "utf-8");
const CLEAN = readFileSync(path.join(FIXTURES, "clean.html"), "utf-8").replace(
  '<section id="contact">',
  '<section id="services"><p>What we do.</p></section>\n  <section id="process"><p>How it works.</p></section>\n  <section id="contact">',
);
const LOGO = readFileSync(path.join(ROOT, "clients", "lanternworks-studio", "logo.svg"));

const brief = {
  clientSlug: "dreamsign-pilot",
  entitySlug: "dreamsign",
  projectName: "DreamSign Homepage",
  goal: "A one-page homepage introducing DreamSign's services.",
  requiredSections: ["hero", "services", "process", "contact"],
  brandNotes: "Clean, trustworthy, restrained.",
  templatePreference: "clean-agency",
  source: "placeholder-2.0-case",
};

function logoRecord(data = LOGO) {
  const r = inspectLogo(data, "image/svg+xml");
  return { ...r, path: `uploads/0b7c3f7e-1d2a-4c55-9e8f-2a1b3c4d5e6f/${r.sha256}.svg` };
}

function setup(opts: {
  firstPage: string;
  revisedPage?: string;
  sink?: InMemoryAuditSink;
  store?: MemoryArtifactStore;
  maxQaRevisions?: number;
  brandAssets?: WorkflowDeps["brandAssets"];
  probes?: () => Promise<PreflightCheck[]>;
}) {
  const builder = new BuilderMock((req) => (req.user.includes("Issues to fix") ? opts.revisedPage ?? opts.firstPage : opts.firstPage));
  const qaModel = new EvaluatorMock(() => "VERDICT: APPROVED");
  const sink = opts.sink ?? new InMemoryAuditSink();
  const store = opts.store ?? new MemoryArtifactStore();
  const deps: WorkflowDeps = {
    frontEndAgent: createFrontendBuilderAgent({ builderModel: builder, evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: qaModel }),
    registry: createSeedRegistry(),
    audit: sink,
    reader: sink,
    artifacts: store,
    knownClientSlugs: ["dreamsign-pilot", "bennett-co"],
    maxQaRevisions: opts.maxQaRevisions,
    ...(opts.brandAssets ? { brandAssets: opts.brandAssets } : {}),
    ...(opts.probes ? { providerProbes: opts.probes } : {}),
  };
  return { deps, builder, sink, store };
}

const spawns = (events: AuditEvent[], runId: string) =>
  events.filter((e) => e.runId === runId && e.action === "agent.spawn").map((e) => String(e.payload?.role));

afterEach(() => clearProvidedLogoAssets());

test("a brief that says to use the client's logo, with no logo attached, stops before any paid step and asks for it", async () => {
  const { deps, sink, builder } = setup({ firstPage: CLEAN });
  const r = await buildAndVerify({ ...brief, brandNotes: "Navy and orange only; the provided logo.svg used as-is (no redrawing)." }, deps);
  assert.equal(r.status, "needs_input");
  assert.deepEqual(r.preflightNeeds?.map((n) => n.key), ["asset.logo"]);
  assert.equal(builder.calls.length, 0, "nothing was spent");
  assert.deepEqual(spawns(sink.events, r.workflowRunId), []);
  const halt = sink.events.find((e) => e.action === "workflow.halt")!;
  assert.equal(halt.payload?.stage, "preflight");
  const pre = sink.events.find((e) => e.action === "workflow.preflight")!;
  assert.equal(pre.payload?.ok, false);
  assert.equal(pre.outcome, "failure");
});

test("the owner can choose to build without the logo", async () => {
  const { deps } = setup({ firstPage: CLEAN });
  const r = await buildAndVerify({ ...brief, brandNotes: "Use our existing logo.", ownerSkipped: ["Logo file"] }, deps);
  assert.equal(r.status, "awaiting_launch_approval");
});

test("an attached logo is loaded and verified before the build; a swapped file stops the run with nothing spent", async () => {
  const logo = logoRecord();
  const ok = setup({ firstPage: CLEAN, brandAssets: { read: async (p) => (assert.equal(p, logo.path), LOGO) } });
  const r = await buildAndVerify({ ...brief, logo }, ok.deps);
  assert.equal(r.status, "awaiting_launch_approval");
  assert.equal(logoAssetFor({ logo })!.file, "logo.svg", "the starters can now place it");
  const pre = ok.sink.events.find((e) => e.action === "workflow.preflight")!;
  assert.equal(pre.payload?.ok, true);

  clearProvidedLogoAssets();
  const swapped = setup({ firstPage: CLEAN, brandAssets: { read: async () => Buffer.from(LOGO.toString().replace("#14213D", "#000000")) } });
  const bad = await buildAndVerify({ ...brief, logo }, swapped.deps);
  assert.equal(bad.status, "needs_input");
  assert.match(bad.reason ?? "", /Logo file/);
  assert.equal(swapped.builder.calls.length, 0);

  // No brand-asset store at all: fail closed, never build without the logo the brief names.
  const none = setup({ firstPage: CLEAN });
  assert.equal((await buildAndVerify({ ...brief, logo }, none.deps)).status, "needs_input");
});

test("a provider that fails its readiness probe stops the run with nothing spent", async () => {
  const { deps, builder, sink } = setup({ firstPage: CLEAN, probes: async () => [{ id: "provider.reviewer", ok: false, detail: "HTTP 400: credit balance is too low (credits exhausted)" }] });
  const r = await buildAndVerify(brief, deps);
  assert.equal(r.status, "provider_unavailable");
  assert.match(r.reason ?? "", /credits exhausted/);
  assert.equal(builder.calls.length, 0);
  assert.deepEqual(spawns(sink.events, r.workflowRunId), []);
  // A probe that throws is a failed check, not a crash.
  const t = setup({ firstPage: CLEAN, probes: async () => { throw new Error("socket hang up"); } });
  assert.equal((await buildAndVerify(brief, t.deps)).status, "provider_unavailable");
});

test("continue with fixes (revise): the stored findings go straight to the builder; the failing site is not re-checked first", async () => {
  const sink = new InMemoryAuditSink();
  const store = new MemoryArtifactStore();
  const halted = await buildAndVerify(brief, setup({ firstPage: BROKEN, maxQaRevisions: 0, sink, store }).deps);
  assert.equal(halted.status, "failed_verification");
  const findings = lastQaFindings(await sink.listByRun(halted.workflowRunId));
  assert.ok(findings && findings.length > 0);

  const second = setup({ firstPage: BROKEN, revisedPage: CLEAN, maxQaRevisions: 0, sink, store });
  const before = sink.events.length;
  const r = await resumeBuildAndVerify(halted.workflowRunId, second.deps, { reopen: { reason: "fix and continue", by: "user-1" }, fromStep: "revise" });
  assert.equal(r.status, "awaiting_launch_approval", r.reason ?? "");
  const after = sink.events.slice(before);
  const firstSpawn = after.find((e) => e.action === "agent.spawn")!;
  assert.equal(firstSpawn.payload?.role, "front-end-builder", "the builder runs first, no QA pass on the known-failing site");
  assert.equal(after.find((e) => e.action === "workflow.reopen")!.payload?.fromStep, "revise");
  // The builder got the exact findings.
  assert.ok(second.builder.calls.some((c) => findings!.some((f) => c.user.includes(f.slice(0, 40)))));
});

test("revise with nothing saved builds again; qa re-checks the saved site with no builder call first", async () => {
  const sink = new InMemoryAuditSink();
  const store = new MemoryArtifactStore();
  // Stopped by a provider probe before anything was saved: no findings, no checkpoint.
  const blocked = setup({ firstPage: BROKEN, sink, store, maxQaRevisions: 0 });
  const stopped = await buildAndVerify(brief, { ...blocked.deps, providerProbes: async () => [{ id: "provider.builder", ok: false, detail: "unreachable" }] });
  assert.equal(stopped.status, "provider_unavailable");
  assert.equal(lastQaFindings(await sink.listByRun(stopped.workflowRunId)), null);
  const again = setup({ firstPage: CLEAN, sink, store });
  const r = await resumeBuildAndVerify(stopped.workflowRunId, again.deps, { reopen: { reason: "try again", by: "u" }, fromStep: "revise" });
  assert.equal(r.status, "awaiting_launch_approval", "nothing was saved, so the engine builds (the only honest option)");
  const reopen = sink.events.filter((e) => e.runId === stopped.workflowRunId && e.action === "workflow.reopen").at(-1)!;
  assert.equal(reopen.payload?.fromStep, "rebuild");

  // qa on a saved, failing site: the checks run again, the builder is not called before them.
  const s2 = new InMemoryAuditSink();
  const st2 = new MemoryArtifactStore();
  const h = await buildAndVerify(brief, setup({ firstPage: BROKEN, maxQaRevisions: 0, sink: s2, store: st2 }).deps);
  const q = setup({ firstPage: CLEAN, maxQaRevisions: 0, sink: s2, store: st2 });
  const before = s2.events.length;
  const r2 = await resumeBuildAndVerify(h.workflowRunId, q.deps, { reopen: { reason: "check again", by: "u" }, fromStep: "qa" });
  assert.equal(s2.events.slice(before).find((e) => e.action === "agent.spawn")!.payload?.role, "qa-evaluator");
  assert.equal(r2.status, "failed_verification", "the same broken site fails the same way");
});

test("rebuild writes the site again with a full revision budget", async () => {
  const sink = new InMemoryAuditSink();
  const store = new MemoryArtifactStore();
  const h = await buildAndVerify(brief, setup({ firstPage: BROKEN, maxQaRevisions: 1, sink, store }).deps);
  assert.equal(h.status, "failed_verification");
  const fresh = setup({ firstPage: BROKEN, revisedPage: CLEAN, maxQaRevisions: 1, sink, store });
  const before = sink.events.length;
  const r = await resumeBuildAndVerify(h.workflowRunId, fresh.deps, { reopen: { reason: "build again", by: "u" }, fromStep: "rebuild" });
  assert.equal(r.status, "awaiting_launch_approval", "fresh build fails once, its one revision passes");
  const after = sink.events.slice(before);
  assert.equal(after.find((e) => e.action === "agent.spawn")!.payload?.role, "front-end-builder");
  assert.ok(!fresh.builder.calls[0]!.user.includes("Issues to fix"), "a fresh build, not a revision");
});

test("lastQaFindings skips a later readiness stop and never reaches past the saved site", () => {
  const row = (action: string, payload: Record<string, unknown> = {}) => ({ actor: "workflow:build-and-verify", action, payload }) as never;
  const qaFailure = { failedChecks: [{ checkId: "x", details: ["broken"] }], evaluatorIssues: ["no logo"] };
  assert.deepEqual(lastQaFindings([row("workflow.checkpoint"), row("workflow.halt", { stage: "qa", qaFailure }), row("workflow.reopen"), row("workflow.halt", { stage: "preflight", qaFailure: null })]), ["[x] broken", "[evaluator] no logo"]);
  assert.equal(lastQaFindings([row("workflow.halt", { stage: "qa", qaFailure }), row("workflow.checkpoint")]), null, "findings about an older site are stale");
  assert.equal(lastQaFindings([]), null);
});
