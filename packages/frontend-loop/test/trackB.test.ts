/**
 * Step 4B M4: Track B content, palette, the isolated build and the builder loop. The builder and
 * reviewer are MockModelClients and the content is the SYNTHETIC Northfold fixture. The build tests run
 * the real `next build` from the committed starter, offline and in the network sandbox, so they need the
 * starter's packages in the local npm cache (CI warms it with `npm ci` in starters/track-b first).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MockModelClient } from "../src/modelClient.js";
import { loadBrief } from "../src/brief.js";
import { contrast } from "../src/trackA/palette.js";
import { validateSiteContent, type SiteContent } from "../src/trackB/content.js";
import { buildTrackBPalette } from "../src/trackB/palette.js";
import { ALLOWED_ENV, probeIsolation, runIsolated } from "../src/trackB/isolate.js";
import { buildTrackBSite, starterSourceFiles, STARTER_VERSION, TrackBBuildError, type TrackBBuild } from "../src/trackB/build.js";
import { TrackBLoop, trackBSystemPrompt } from "../src/trackB/loop.js";
import { createTrackBBuilderAgent } from "../src/trackB/agent.js";

const FX = path.join(import.meta.dirname, "fixtures", "track-b");
const brief = loadBrief(path.join(FX, "northfold.brief.json"));
const FIXTURE_TEXT = readFileSync(path.join(FX, "northfold.content.json"), "utf-8");
const fixture = () => JSON.parse(FIXTURE_TEXT) as SiteContent;
const valid = () => validateSiteContent(fixture(), brief).content!;

test("the SYNTHETIC Northfold fixture is valid Track B content", () => {
  const { content, errors } = validateSiteContent(fixture(), brief);
  assert.deepEqual(errors, []);
  assert.equal(content!.pages.length, 3);
});

test("content rules: invented facts, a page without an h1 opener, repeated layouts and missing sections are refused by path", () => {
  const c = fixture();
  c.business.email = { value: "hello@northfold.studio", source: "brief" };
  // services page: drop the prose opener and lead with two services sections in a row
  const svc = c.pages[1]!.sections.find((s) => s.type === "services")!;
  c.pages[1]!.sections = [svc, { ...svc, id: "more-services" }, ...c.pages[1]!.sections.filter((s) => s.type === "cta")];
  c.pages[0]!.sections = c.pages[0]!.sections.filter((s) => s.id !== "work");
  c.pages.push({ slug: "api", navLabel: "Api", title: "x", description: "y", sections: c.pages[2]!.sections });
  const { content, errors } = validateSiteContent(c, brief);
  assert.equal(content, null);
  const text = errors.join("\n");
  assert.match(text, /business\.email: "hello@northfold\.studio" is marked source "brief" but is not in the brief/);
  assert.match(text, /pages\[1\] \(services\): the first section must be a hero, prose or contact section/);
  assert.match(text, /sections 0 and 1 are both "services" \(DR-REPEATED-RHYTHM\)/);
  assert.match(text, /The brief requires a section with id "work"/);
  assert.match(text, /slug "api" is reserved/);
});

test("palette: the dark brand gets a visible surface, and dim/muted/accent text all reach 4.5:1", () => {
  const { palette, problems } = buildTrackBPalette(valid().brand.colors);
  assert.deepEqual(problems, []);
  const p = palette!;
  assert.notEqual(p.surface, p.paper);
  for (const fg of [p.ink, p.muted, p.accentInk, p.dim]) assert.ok(contrast(fg, p.paper) >= 4.5, `${fg} on paper`);
  for (const fg of [p.ink, p.muted, p.accentInk]) assert.ok(contrast(fg, p.surface) >= 4.5, `${fg} on surface`);
  assert.ok(contrast(p.dim, p.paper) < contrast(p.ink, p.paper) - 4, "dim is visibly dimmer than ink");
  assert.ok(contrast(p.onDeep, p.deep) >= 4.5 && contrast(p.onAccent, p.accentInk) >= 4.5);
});

test("isolation: the build sandbox cannot reach the network and sees no variable from the parent's environment", async () => {
  process.env.WFACT_CANARY_SECRET = "canary-not-a-real-secret";
  try {
    const probe = await probeIsolation(mkdtempSync(path.join(tmpdir(), "wfact-probe-")));
    assert.equal(probe.network, "blocked", probe.attempts.join("; "));
    assert.equal(probe.attempts.length, 3);
    assert.ok(probe.attempts.every((a) => / failed /.test(a)));
    assert.deepEqual(probe.unexpectedEnv, []);
    assert.ok(!probe.envNames.includes("WFACT_CANARY_SECRET"));
    for (const name of probe.envNames) {
      assert.ok((ALLOWED_ENV as readonly string[]).includes(name) || ["PWD", "SHLVL", "_", "OLDPWD", "__CF_USER_TEXT_ENCODING"].includes(name), name);
    }
    // Not just fetch: a raw TCP connection from the sandbox fails too.
    const tcp = await runIsolated(
      process.execPath,
      ["-e", 'require("net").connect(443, "1.1.1.1").on("connect", () => { console.log("CONNECTED"); process.exit(0) }).on("error", (e) => { console.log("ERR " + e.code); process.exit(0) })'],
      { cwd: tmpdir(), timeoutMs: 20_000 },
    );
    assert.doesNotMatch(tcp.output, /CONNECTED/);
    assert.match(tcp.output, /ERR /);
  } finally {
    delete process.env.WFACT_CANARY_SECRET;
  }
});

let built: TrackBBuild | null = null;
const realBuild = async () => (built ??= await buildTrackBSite(valid()));

test("real isolated build: a static multi-page export, fonts as binary, the built source kept, the isolation recorded", { timeout: 300_000 }, async () => {
  const b = await realBuild();
  assert.deepEqual(b.pages, ["index.html", "services/index.html", "contact/index.html"]);
  assert.equal(b.record.starterVersion, STARTER_VERSION);
  assert.equal(b.record.isolation.network, "blocked");
  assert.deepEqual(b.record.isolation.unexpectedEnv, []);
  assert.ok(b.binary.length >= 2 && b.binary.every((f) => f.endsWith(".woff2")), "two self-hosted font files");
  for (const page of b.pages) {
    const html = b.files[page]!;
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${page}: one h1`);
    assert.doesNotMatch(html, /fonts\.googleapis|(src|href)="https?:/i, `${page}: no third-party requests`);
    assert.ok(html.trimEnd().endsWith("</html>"));
  }
  assert.match(b.files["index.html"]!, /SAMPLE project, not real client work/);
  assert.match(b.files["contact/index.html"]!, /studio@northfold\.example<\/a> <span class="sample">SAMPLE<\/span>/);
  const ld = JSON.parse(b.files["index.html"]!.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!);
  assert.equal(ld.email, undefined, "a SAMPLE email is never published as structured data");
  // The source is exactly what was built: the starter's files, the generated routes and the content.
  for (const f of starterSourceFiles().filter((f) => !f.split("/").some((s) => s.startsWith(".")))) assert.ok(b.source[f] !== undefined, `source has ${f}`);
  assert.ok(b.source["app/services/page.tsx"] && b.source["lib/type.generated.ts"]);
  assert.deepEqual(JSON.parse(b.source["content/site.json"]!), valid());
  assert.ok(!Object.keys(b.source).some((f) => f.startsWith("node_modules/") || f.startsWith("out/")));
});

test("real isolated build is deterministic: the same content gives the same bytes", { timeout: 300_000 }, async () => {
  const a = await realBuild();
  const again = await buildTrackBSite(valid());
  assert.equal(again.record.outputHash, a.record.outputHash);
  assert.deepEqual(Object.keys(again.files).sort(), Object.keys(a.files).sort());
});

test("loop: content is validated, reviewed by a different instance, then built once; the site carries binary, source and record", async () => {
  let builds = 0;
  const fake: TrackBBuild = {
    files: { "index.html": "<html><body><h1>x</h1></body></html>", "a.woff2": "AAAA" },
    binary: ["a.woff2"],
    pages: ["index.html"],
    source: { "app/page.tsx": "x" },
    record: { starterVersion: STARTER_VERSION } as TrackBBuild["record"],
  };
  const builder = new MockModelClient((_req, i) => (i === 0 ? '{"schemaVersion":"track-b/1","pages":[]}' : FIXTURE_TEXT));
  const reviewer = new MockModelClient((_req, i) => (i === 0 ? "VERDICT: CHANGES_REQUESTED\nISSUES:\n- index hero: say what the studio makes" : "VERDICT: APPROVED"));
  const loop = new TrackBLoop({
    builderModel: builder,
    evaluatorModel: reviewer,
    build: async () => {
      builds += 1;
      return fake;
    },
  });
  const r = await loop.run(brief);
  assert.equal(r.approved, true);
  assert.equal(builds, 1, "the expensive build runs once, after approval");
  assert.equal(r.rounds.length, 2);
  assert.match(builder.calls[1]!.user, /\[content\.schema\]/, "validation errors go back to the builder");
  assert.match(builder.calls[2]!.user, /say what the studio makes/, "review issues go back to the builder");
  assert.deepEqual(r.site!.binary, ["a.woff2"]);
  assert.equal(r.site!.source!["app/page.tsx"], "x");
  assert.equal(r.template.id, "track-b");
  assert.match(trackBSystemPrompt(), /DR-THREE-CARD-ROW/);
});

test("loop: a failed build escalates to a human with the log, never retries the content writer", async () => {
  const builder = new MockModelClient(() => FIXTURE_TEXT);
  const reviewer = new MockModelClient(() => "VERDICT: APPROVED");
  const loop = new TrackBLoop({
    builderModel: builder,
    evaluatorModel: reviewer,
    build: async () => {
      throw new TrackBBuildError("next build failed (exit 1)", "Type error: boom");
    },
  });
  const r = await loop.run(brief);
  assert.equal(r.approved, false);
  assert.equal(r.needsHuman, true);
  assert.match(r.escalationReason ?? "", /isolated Track B build failed: next build failed \(exit 1\).*Type error: boom/);
  assert.equal(builder.calls.length, 1);
});

test("agent: Track B revisions need the content JSON; the builder and reviewer must be different instances", () => {
  const m = new MockModelClient(() => "");
  assert.throws(() => new TrackBLoop({ builderModel: m, evaluatorModel: m }), /distinct ModelClient instances/);
  const agent = createTrackBBuilderAgent({ builderModel: m, evaluatorModel: new MockModelClient(() => "") });
  assert.equal(agent.parseInput({ brief }).template.id, "track-b");
  assert.throws(() => agent.parseInput({ brief, revision: { html: "", issues: ["x"] } }), /revision\.contentJson/);
  assert.equal(agent.parseInput({ brief, revision: { issues: ["[render.links] x"], contentJson: "{}" } }).revision!.contentJson, "{}");
});

test("every type pairing stays inside the font weight that keeps mobile LCP in budget (M4: a 90 KB display file broke it)", () => {
  const starter = path.join(import.meta.dirname, "..", "starters", "track-b");
  const routes = readFileSync(path.join(starter, "scripts", "routes.mjs"), "utf-8");
  const faces = Object.fromEntries([...routes.matchAll(/^\s+(\w+): \["([^"]+)"/gm)].map((m) => [m[1]!, m[2]!]));
  const pairings = JSON.parse(routes.match(/const PAIRINGS = (\{[^\n]+\});/)![1]!.replace(/(\w+):/g, '"$1":'));
  for (const [name, [display, text]] of Object.entries(pairings as Record<string, [string, string]>)) {
    const bytes = [display, text].reduce((n, f) => n + statSync(path.join(starter, "node_modules", "@fontsource-variable", faces[f]!)).size, 0);
    assert.ok(bytes <= 100 * 1024, `${name}: ${bytes} bytes of fonts`);
  }
  assert.deepEqual(Object.keys(pairings).sort(), ["editorial", "studio", "technical"]);
});
