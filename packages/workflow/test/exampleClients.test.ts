/**
 * The synthetic example clients (clients/example-*, docs/EXAMPLE-CLIENTS.md) are a regression baseline only while they stay
 * complete, consistent and plainly fake. This holds them to that: every brief parses, passes the consistency check and the
 * readiness check (with its logo), its owner facts are exactly what its plan inputs produce, it answers every Cockpit slot,
 * and every contact detail is a reserved fictional one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { parseBrief } from "@wfact/frontend-loop/brief";
import { inspectLogo, sha256Hex } from "@wfact/frontend-loop/brandAsset";
import { inspectImage } from "@wfact/frontend-loop/media";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvaluatorMock } from "@wfact/verification/modelClient";
import { buildAndVerify, MemoryArtifactStore } from "../src/buildAndVerify.js";
import { checkBriefConsistency, resolveOwnerFacts } from "../src/briefConsistency.js";

const REPO = path.join(import.meta.dirname, "..", "..", "..");
const EXAMPLES = ["example-agency-studio", "example-local-trade"];
const dir = (slug: string) => path.join(REPO, "clients", slug);
const json = (slug: string, file: string) => JSON.parse(readFileSync(path.join(dir(slug), file), "utf-8"));

/** The Cockpit's slots, read from the source so a slot added later fails this test until the examples answer it. */
const SLOT_KEYS = [...readFileSync(path.join(REPO, "apps", "cockpit", "src", "lib", "inputs.ts"), "utf-8").matchAll(/\{ key: "([a-z_]+)", label:/g)].map((m) => m[1]!);

interface Input { kind: string; key: string; label: string; value: string | null; waived: boolean }

for (const slug of EXAMPLES) {
  test(`${slug}: the brief parses, is synthetic, and its owner facts agree with each other`, () => {
    const brief = parseBrief(json(slug, "brief.json"));
    assert.equal(brief.source, "synthetic-provisional-2026-09-30");
    assert.equal(brief.clientSlug, slug);
    assert.equal(brief.requestText, readFileSync(path.join(dir(slug), "raw-request.txt"), "utf-8"), "requestText is raw-request.txt word for word");
    assert.match(brief.requestText!, /^SYNTHETIC EXAMPLE CLIENT/);
    assert.match(brief.requestText!, /quotes are invented stand-ins/);
    const c = checkBriefConsistency(brief);
    assert.deepEqual({ conflicts: c.conflicts, leftovers: c.leftovers }, { conflicts: [], leftovers: [] });
  });

  test(`${slug}: plan-inputs.json answers every Cockpit slot, and produces exactly the brief's owner facts`, () => {
    assert.ok(SLOT_KEYS.length >= 9, `read ${SLOT_KEYS.length} slots from inputs.ts`);
    const { inputs } = json(slug, "plan-inputs.json") as { inputs: Input[] };
    for (const key of SLOT_KEYS) {
      const i = inputs.find((x) => x.key === key);
      assert.ok(i && (i.waived || (i.value ?? "").trim()), `slot ${key} is answered or deliberately waived`);
    }
    assert.equal(new Set(inputs.map((i) => i.key)).size, inputs.length, "one input per key");
    const brief = parseBrief(json(slug, "brief.json"));
    assert.deepEqual(resolveOwnerFacts(inputs), brief.ownerFacts);
    assert.deepEqual(inputs.filter((i) => i.waived).map((i) => i.label), brief.ownerSkipped ?? []);
    assert.equal(brief.siteUrl, inputs.find((i) => i.key === "site_url")?.value);
  });

  test(`${slug}: every contact detail is a reserved fictional one (555-01xx, example.com/.org)`, () => {
    const text = readFileSync(path.join(dir(slug), "brief.json"), "utf-8") + readFileSync(path.join(dir(slug), "plan-inputs.json"), "utf-8");
    const phones = [...text.matchAll(/\(\d{3}\) \d{3}-\d{4}/g)].map((m) => m[0]);
    assert.ok(phones.length > 0 && phones.every((p) => /555-01\d\d$/.test(p)), `phones: ${phones.join(", ")}`);
    const emails = [...text.matchAll(/[\w.+-]+@[\w.-]+\.[a-z]+/gi)].map((m) => m[0]);
    assert.ok(emails.length > 0 && emails.every((e) => /\.example\.(com|org)$|@example\.(com|org)$/i.test(e)), `emails: ${emails.join(", ")}`);
    const sites = [...text.matchAll(/https:\/\/[\w.-]+/g)].map((m) => m[0]);
    assert.ok(sites.every((s) => /\.example\.(com|org)$/.test(s)), `sites: ${sites.join(", ")}`);
  });

  test(`${slug}: the logo and every slot image are files the Cockpit upload would accept`, () => {
    const logo = readFileSync(path.join(dir(slug), "logo.svg"));
    assert.ok(inspectLogo(logo, "image/svg+xml").width > 0);
    const { uploads } = json(slug, "plan-inputs.json") as { uploads: { key: string; file: string; slot?: string }[] };
    const images = uploads.filter((u) => u.slot);
    assert.deepEqual(images.map((u) => `${u.slot}.png`).sort(), readdirSync(path.join(dir(slug), "images")).sort());
    for (const u of images) assert.ok(inspectImage(readFileSync(path.join(dir(slug), u.file)), "image/png").width > 0, u.file);
  });

  test(`${slug}: the readiness check passes with the logo attached, before any builder call`, async () => {
    const data = readFileSync(path.join(dir(slug), "logo.svg"));
    const logo = { ...inspectLogo(data, "image/svg+xml"), path: `uploads/00000000-0000-4000-8000-000000000000/${sha256Hex(data)}.svg` };
    const sink = new InMemoryAuditSink();
    let builderCalledAfterPreflight = false;
    const builder = new BuilderMock(() => {
      builderCalledAfterPreflight = sink.events.some((e) => e.action === "workflow.preflight");
      return "<!doctype html><html><head><title>x</title></head><body><main><h1>x</h1></main></body></html>";
    });
    await buildAndVerify({ ...json(slug, "brief.json"), logo }, {
      frontEndAgent: createFrontendBuilderAgent({ builderModel: builder, evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
      qaAgent: createQaEvaluatorAgent({ evaluatorModel: new EvaluatorMock(() => "VERDICT: APPROVED") }),
      registry: createSeedRegistry(),
      audit: sink,
      reader: sink,
      artifacts: new MemoryArtifactStore(),
      knownClientSlugs: EXAMPLES,
      maxQaRevisions: 0,
      brandAssets: { read: async (p) => (p === logo.path ? data : Promise.reject(new Error(`no asset at ${p}`))) },
    });
    const pre = sink.events.find((e) => e.action === "workflow.preflight")?.payload as { ok: boolean; checks: { id: string; ok: boolean }[] };
    assert.equal(pre.ok, true, JSON.stringify(pre.checks));
    assert.deepEqual(pre.checks.filter((c) => c.id.startsWith("brief.")).map((c) => [c.id, c.ok]), [["brief.logo", true], ["brief.consistency", true]]);
    assert.ok(builderCalledAfterPreflight, "the build went on past the readiness check");
  });
}
