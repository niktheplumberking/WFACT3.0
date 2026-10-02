/**
 * Step 4B M4: a Track B site through build-and-verify. The builder is the real Track B loop with mock
 * models (content = the SYNTHETIC Northfold fixture) and a stand-in for the Next.js build (the real,
 * isolated build is tested in frontend-loop and rendered-qa); QA sees the site through a recording suite.
 * Proves: output files in folders, binary fonts stored as bytes, the built source under _source/ and the
 * build record are all pinned by the manifest; QA receives the site back verified (fonts as base64, no
 * source files); a changed font is refused; a resume uses the Track B builder.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createTrackBBuilderAgent } from "@wfact/frontend-loop/trackB/agent";
import type { TrackBBuild } from "@wfact/frontend-loop/trackB/build";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvaluatorMock } from "@wfact/verification/modelClient";
import type { AsyncCheckSuite, VerificationContext } from "@wfact/verification/checks/types";
import { buildAndVerify, readSiteVerified, recordedBuilderTemplate, MemoryArtifactStore, SITE_MANIFEST, ARTIFACT_PATH_RE, type WorkflowDeps } from "../src/buildAndVerify.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const FX = path.join(ROOT, "packages/frontend-loop/test/fixtures/track-b");
const brief = JSON.parse(readFileSync(path.join(FX, "northfold.brief.json"), "utf-8"));
const CONTENT = readFileSync(path.join(FX, "northfold.content.json"), "utf-8");
const DIR = "clients/northfold-studio/sites/track-b";
const FONT = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0xff, 0x10, 0x80]); // binary, not valid UTF-8

const page = (title: string) => `<!doctype html><html lang="en"><head><title>${title}</title></head><body><main><h1>${title}</h1></main></body></html>`;
const fakeBuild = async (): Promise<TrackBBuild> => ({
  files: {
    "index.html": page("Home"),
    "services/index.html": page("Services"),
    "contact/index.html": page("Contact"),
    "_next/static/chunks/app/page-abc.js": "self.a=1;",
    "_next/static/media/f-s.p.woff2": FONT.toString("base64"),
    "__next.__PAGE__.txt": "0:{}",
  },
  binary: ["_next/static/media/f-s.p.woff2"],
  pages: ["index.html", "services/index.html", "contact/index.html"],
  source: { "app/page.tsx": "export default 1;", "lib/type.generated.ts": "x", "package-lock.json": "{}" },
  record: { starterVersion: "track-b-starter/1.0.0", outputHash: "h" } as TrackBBuild["record"],
});

function setup(store = new MemoryArtifactStore()) {
  const seen: VerificationContext[] = [];
  const recorder: AsyncCheckSuite = { id: "recorder", description: "records what QA was given", run: async (ctx) => (seen.push(ctx), [{ checkId: "recorder", passed: true, details: [] }]) };
  const sink = new InMemoryAuditSink();
  const deps: WorkflowDeps = {
    frontEndAgent: createTrackBBuilderAgent({ builderModel: new BuilderMock(() => CONTENT), evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED"), build: fakeBuild }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: new EvaluatorMock(() => "VERDICT: APPROVED"), checks: [], asyncChecks: [recorder] }),
    registry: createSeedRegistry(),
    audit: sink,
    reader: sink,
    artifacts: store,
    knownClientSlugs: ["northfold-studio", "summit-line-roofing"],
  };
  return { deps, store, sink, seen };
}

test("a Track B site is checkpointed with folders, fonts as bytes, the built source and the build record", async () => {
  const { deps, store, sink, seen } = setup();
  const result = await buildAndVerify(brief, deps);
  assert.equal(result.status, "awaiting_launch_approval", result.reason ?? "");
  assert.equal(result.lastCheckpoint!.path, `${DIR}/${SITE_MANIFEST}`);
  assert.equal(await recordedBuilderTemplate(result.workflowRunId, sink), "track-b");

  assert.deepEqual(store.blobs.get(`${DIR}/_next/static/media/f-s.p.woff2`), FONT, "the font is stored as its real bytes");
  assert.ok(store.files.has(`${DIR}/services/index.html`) && store.files.has(`${DIR}/_source/app/page.tsx`) && store.files.has(`${DIR}/content.json`));
  const manifest = JSON.parse(store.files.get(`${DIR}/${SITE_MANIFEST}`)!);
  assert.deepEqual(manifest.binary, ["_next/static/media/f-s.p.woff2"]);
  assert.equal(manifest.build.starterVersion, "track-b-starter/1.0.0");
  assert.ok(manifest.files.some((f: { name: string }) => f.name === "_source/package-lock.json"));

  // QA got the output (not the source), fonts as base64 marked binary, every file re-verified.
  const qa = seen[0]!.site!;
  assert.deepEqual(qa.pages, ["index.html", "services/index.html", "contact/index.html"]);
  assert.deepEqual(qa.binary, ["_next/static/media/f-s.p.woff2"]);
  assert.equal(Buffer.from(qa.files["_next/static/media/f-s.p.woff2"]!, "base64").compare(FONT), 0);
  assert.ok(!Object.keys(qa.files).some((f) => f.startsWith("_source/")));
  const back = await readSiteVerified(store, result.lastCheckpoint!);
  assert.equal(JSON.parse(back.contentJson).business.name, "Northfold");
});

test("a font changed after the checkpoint is refused, not verified", async () => {
  class TamperingStore extends MemoryArtifactStore {
    override async readVerified(artifact: Parameters<MemoryArtifactStore["readVerified"]>[0]) {
      if (artifact.path.endsWith(SITE_MANIFEST)) this.blobs.set(`${DIR}/_next/static/media/f-s.p.woff2`, Buffer.from("swapped"));
      return super.readVerified(artifact);
    }
  }
  const { deps } = setup(new TamperingStore());
  const result = await buildAndVerify(brief, deps);
  assert.equal(result.status, "checkpoint_corrupt");
  assert.match(result.reason ?? "", /f-s\.p\.woff2 changed since checkpoint/);
});

test("artifact paths: folders and site file types are allowed; traversal, dotfiles and other types are not", () => {
  for (const ok of [`${DIR}/services/index.html`, `${DIR}/_next/static/chunks/app/page-abc.js`, `${DIR}/_source/app/page.tsx`, `${DIR}/_next/static/media/a-s.p.woff2`, `${DIR}/__next.__PAGE__.txt`]) {
    assert.ok(ARTIFACT_PATH_RE.test(ok), ok);
  }
  for (const bad of [`${DIR}/../x.html`, `${DIR}/_source/.gitignore`, `${DIR}/a/.env`, `${DIR}/x.sh`, `clients/northfold-studio/sites/track-b`, `clients/x/../y/pages/a.html`]) {
    assert.ok(!ARTIFACT_PATH_RE.test(bad), bad);
  }
});
