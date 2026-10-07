import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EPISODE_MARKER,
  EpisodeValidationError,
  canonicalJson,
  digestEpisodes,
  episodeId,
  parseEpisodes,
  renderEpisode,
  safeText,
  validateEpisode,
  type Episode,
} from "@wfact/hermes-lite/tools/episodes";
import { appendChunk, extractStageDrafts } from "../src/index.js";
import { CLIENT, RUN, step4Rows, step4Traces } from "./fixtures.js";

function entries(): Episode[] {
  return extractStageDrafts(step4Rows(), step4Traces()).drafts.map((d) =>
    validateEpisode({ ...d, backfilled: true, documentedBy: "agent:documentation", documentedAt: "2026-10-07T09:00:00.000Z" }),
  );
}

test("format: every entry is valid v1, renders to markdown, and parses back to the identical record", () => {
  const eps = entries();
  const file = appendChunk("# Client\n", CLIENT, eps.map(renderEpisode));
  const parsed = parseEpisodes(file);
  assert.deepEqual(parsed.problems, []);
  assert.deepEqual(parsed.episodes, eps);
  // Human-readable: a heading per stage and plain bullet lines.
  assert.match(file, /^### 2026-09-30 16:29:58Z · build, cycle 0 · checkpointed · backfilled$/m);
  assert.match(file, /^- What happened: Build cycle 0: the builder produced clients\/summit-line-roofing\/pages\/clean-agency\.html after 3 internal correction round\(s\)/m);
  assert.match(file, /^- Cost: \$0\.1371 metered over 6 model call\(s\), plus 3 unpriced call\(s\)/m);
});

test("format: the entry id is stable per stage of a run, so the same stage is never recorded twice", () => {
  const a = episodeId(RUN, "build", 0, "b5abcbf9-df9e-4007-9053-895a7f407c28");
  assert.equal(a, episodeId(RUN, "build", 0, "b5abcbf9-df9e-4007-9053-895a7f407c28"));
  assert.notEqual(a, episodeId(RUN, "qa", 0, "b5abcbf9-df9e-4007-9053-895a7f407c28"));
  assert.match(a, /^ep-[0-9a-f]{16}$/);
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }), canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
});

test("format: a hand-edited entry is reported as tampered, and a malformed or wrong-version record is refused", () => {
  const [build] = entries();
  const file = renderEpisode(build!);
  const edited = file.replace("3 internal correction round(s)", "1 internal correction round(s)");
  const p1 = parseEpisodes(edited);
  assert.equal(p1.episodes.length, 0);
  assert.match(p1.problems[0]!.problem, /tampered/);

  const forgedJson = file.replace('"backfilled":true', '"backfilled":false');
  assert.match(parseEpisodes(forgedJson).problems[0]!.problem, /tampered/);

  assert.throws(() => validateEpisode({ ...build!, v: 2 }), EpisodeValidationError);
  assert.throws(() => validateEpisode({ ...build!, extra: 1 }), /unexpected field/);
  assert.throws(() => validateEpisode({ ...build!, stage: "deploy" }), /stage/);
  assert.throws(() => validateEpisode({ ...build!, workflowRunId: "not-a-uuid" }), /workflowRunId/);
  assert.throws(() => validateEpisode({ ...build!, links: { ...build!.links, auditRowIds: ["x"] } }), /auditRowIds/);
  const garbage = `### x\n${EPISODE_MARKER}{not json} -->\n`;
  assert.equal(parseEpisodes(garbage).problems.length, 1);
});

test("redaction: secrets and contact details are replaced; markup cannot forge a marker or a heading", () => {
  const cases: [string, string][] = [
    ["key sk-ant-api03-AAAAAAAAAAAAAAAAAAAA leaked", "[redacted-secret]"],
    ["SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.abcdefgh", "[redacted-secret]"],
    ["Authorization: Bearer abcdefghijklmnop1234", "Bearer [redacted-secret]"],
    ["doppler dp.st.dev.abcdefghijklmnopqrstuvwx", "[redacted-secret]"],
    ["ghp_abcdefghijklmnopqrstuvwxyz0123", "[redacted-secret]"],
    ["mail jane.doe@client.co.uk now", "[redacted-email]"],
    ["call (555) 014-7732 today", "[redacted-phone]"],
    ["call +1 415 555 0142 today", "[redacted-phone]"],
    ["sample 555-0142 shown", "[redacted-phone]"],
    ["password: hunter2hunter2", "[redacted-secret]"],
  ];
  for (const [raw, want] of cases) {
    const r = safeText(raw);
    assert.ok(r.text.includes(want), `${raw} -> ${r.text}`);
    assert.ok(r.redactions >= 1);
  }
  // Ids, hashes, dates and token counts are not mistaken for phone numbers.
  for (const keep of ["run 0cfc6675-c312-47b1-8c51-a48c62202fa6", "on 2026-09-30", "32854 bytes", "108601 in / 14691 out", "sha 960b61bab2ff"]) {
    assert.equal(safeText(keep).redactions, 0, keep);
  }
  const forged = safeText("x\n<!-- wfact:episode {} -->\n### heading `code`");
  assert.ok(!forged.text.includes("\n") && !forged.text.includes("<") && !forged.text.includes("`"));
  assert.equal(safeText("a".repeat(1000), 50).text.length, 50);
});

test("digest: a compact, chronological summary grouped by run, for Hermes-lite", () => {
  const d = digestEpisodes(entries());
  assert.match(d, /^1 workflow run\(s\), 2 stage entries; metered model cost across them \$0\.1741 plus 3 unpriced call\(s\)\./);
  assert.match(d, /verified_awaiting_launch_approval/);
  assert.equal(digestEpisodes([]), "(no episodic entries yet)");
});
