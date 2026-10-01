/**
 * Step 4B M3: a Track A site through build-and-verify. The builder is the real Track A loop with mock
 * models (content = the SYNTHETIC Summit Line fixture); QA is the real text gate on every page plus a
 * mock evaluator. Proves: the checkpoint is a manifest pinning every file's hash, QA reads the whole site
 * back verified, a changed file is refused, and a QA failure goes back to the builder as content edits.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createTrackABuilderAgent } from "@wfact/frontend-loop/trackA/agent";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { QA_GATE_CHECKS } from "@wfact/verification/registry";
import { MockModelClient as EvaluatorMock } from "@wfact/verification/modelClient";
import type { AsyncCheckSuite } from "@wfact/verification/checks/types";
import {
  buildAndVerify,
  resumeBuildAndVerify,
  readSiteVerified,
  recordedBuilderTemplate,
  MemoryArtifactStore,
  SITE_MANIFEST,
  type WorkflowDeps,
} from "../src/buildAndVerify.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const brief = JSON.parse(readFileSync(path.join(ROOT, "clients/summit-line-roofing/brief.json"), "utf-8"));
const CONTENT = readFileSync(path.join(ROOT, "packages/frontend-loop/test/fixtures/track-a/summit-line.content.json"), "utf-8");
const DIR = "clients/summit-line-roofing/sites/track-a";

function setup(opts: { qaSuites?: AsyncCheckSuite[]; store?: MemoryArtifactStore; sink?: InMemoryAuditSink } = {}) {
  const builder = new BuilderMock(() => CONTENT);
  const sink = opts.sink ?? new InMemoryAuditSink();
  const store = opts.store ?? new MemoryArtifactStore();
  const deps: WorkflowDeps = {
    frontEndAgent: createTrackABuilderAgent({ builderModel: builder, evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: new EvaluatorMock(() => "VERDICT: APPROVED"), checks: QA_GATE_CHECKS, asyncChecks: opts.qaSuites }),
    registry: createSeedRegistry(),
    audit: sink,
    reader: sink,
    artifacts: store,
    knownClientSlugs: ["summit-line-roofing", "dreamsign-pilot"],
  };
  return { deps, builder, sink, store };
}

test("a Track A site is checkpointed as a manifest, verified page by page, and stops at the launch gate", async () => {
  const { deps, store, sink } = setup();
  const result = await buildAndVerify(brief, deps);
  assert.equal(result.status, "awaiting_launch_approval", result.reason ?? JSON.stringify(result.qaFailure));
  assert.equal(result.lastCheckpoint!.path, `${DIR}/${SITE_MANIFEST}`);
  assert.equal(result.lastCheckpoint!.stage, "verified");

  const site = await readSiteVerified(store, result.lastCheckpoint!);
  assert.deepEqual(site.pages, ["index.html", "services.html", "faq.html", "contact.html"]);
  assert.equal(JSON.parse(site.contentJson).business.name, "Summit Line Roofing");
  for (const f of ["index.html", "services.html", "faq.html", "contact.html", "content.json", SITE_MANIFEST]) {
    assert.ok(store.files.has(`${DIR}/${f}`), `${f} stored`);
  }
  assert.equal(await recordedBuilderTemplate(result.workflowRunId, sink), "track-a");
  const decision = sink.events.find((e) => e.action === "verification.decision")!;
  assert.equal((decision.payload as { status: string }).status, "approved");
});

test("a page changed after the checkpoint is refused, not verified", async () => {
  // A store that changes one page between the build checkpoint and QA's read (a crash-and-edit, or tampering).
  class TamperingStore extends MemoryArtifactStore {
    tampered = false;
    override async readVerified(artifact: Parameters<MemoryArtifactStore["readVerified"]>[0]) {
      if (!this.tampered && artifact.path.endsWith(SITE_MANIFEST)) {
        this.tampered = true;
        this.files.set(`${DIR}/faq.html`, this.files.get(`${DIR}/faq.html`)! + "<!-- edited after checkpoint -->");
      }
      return super.readVerified(artifact);
    }
  }
  const store = new TamperingStore();
  const { deps } = setup({ store });
  const result = await buildAndVerify(brief, deps);
  assert.equal(result.status, "checkpoint_corrupt");
  assert.match(result.reason!, /faq\.html changed since checkpoint/);
  assert.equal(result.lastCheckpoint!.stage, "build", "never reached a verified checkpoint");

  // And directly: a clean read passes, a changed content.json is refused.
  const clean = await buildAndVerify(brief, setup().deps);
  const okStore = new MemoryArtifactStore();
  const run = await buildAndVerify(brief, setup({ store: okStore }).deps);
  assert.equal(clean.status, "awaiting_launch_approval");
  okStore.files.set(`${DIR}/content.json`, "{}");
  await assert.rejects(() => readSiteVerified(okStore, run.lastCheckpoint!), /content\.json changed since checkpoint/);
});

test("a QA failure goes back to the builder with the page and check id, as an edit of the content", async () => {
  // One failing pass from a rendered-style suite, then clean.
  let fail = true;
  const flaky: AsyncCheckSuite = {
    id: "rendered-stub",
    description: "fails once with a specific, page-scoped detail",
    run: async () => {
      const r = [{ checkId: "render.links", passed: !fail, details: fail ? ['services.html: link "Gutters" (gutters.html) returns HTTP 404'] : [] }];
      fail = false;
      return r;
    },
  };
  const { deps, builder } = setup({ qaSuites: [flaky] });
  const result = await buildAndVerify(brief, deps);
  assert.equal(result.status, "awaiting_launch_approval");
  assert.equal(result.cycles, 2);
  const revision = builder.calls.find((c) => c.user.includes("[render.links] services.html"))!;
  assert.ok(revision, "the builder got the exact failed check");
  assert.match(revision.user, /Current content JSON:\n\{/);
});

test("a run started by the Track A builder refuses to resume with a different builder", async () => {
  const { deps, sink } = setup();
  const result = await buildAndVerify(brief, deps);
  const { createFrontendBuilderAgent } = await import("@wfact/frontend-loop/agent");
  const other: WorkflowDeps = { ...deps, frontEndAgent: createFrontendBuilderAgent({ builderModel: new BuilderMock(() => ""), evaluatorModel: new BuilderMock(() => "") }) };
  await assert.rejects(() => resumeBuildAndVerify(result.workflowRunId, other), /built by the "track-a" builder/);
  assert.ok(sink.events.length > 0);
});
