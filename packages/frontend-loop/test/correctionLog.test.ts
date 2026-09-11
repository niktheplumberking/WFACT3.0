import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendCorrectionLogRows,
  formatCorrectionSummary,
  DREAMSIGN_BASELINE_ROUNDS,
} from "../src/correctionLog.js";
import type { CorrectionRound } from "../src/loop.js";

const TEMPLATE_MEMORY = `# Client: dreamsign-pilot

## Entity

dreamsign

## Correction-round log

_(per Operator's Manual Phase 4/7 ...)_

| Round | Stage | What was flagged | Fixed by | Date |
|---|---|---|---|---|

## Notes

_(nothing yet)_
`;

function makeRounds(): CorrectionRound[] {
  return [
    { round: 1, verdict: "changes_requested", issues: ["missing contact section"], timestamp: "2026-09-10T00:00:00Z" },
    { round: 2, verdict: "approved", issues: [], timestamp: "2026-09-10T00:05:00Z" },
  ];
}

test("appendCorrectionLogRows adds rows without touching the rest of the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "wfact-frontend-loop-test-"));
  const memoryPath = join(dir, "memory.md");
  writeFileSync(memoryPath, TEMPLATE_MEMORY, "utf-8");

  try {
    appendCorrectionLogRows(memoryPath, makeRounds(), "4_homepage_build", "frontend-loop test");
    const updated = readFileSync(memoryPath, "utf-8");

    assert.match(updated, /\| 1 \| 4_homepage_build \| missing contact section \| frontend-loop test \| 2026-09-10 \|/);
    assert.match(updated, /\| 2 \| 4_homepage_build \| \(approved, no issues\) \| frontend-loop test \| 2026-09-10 \|/);
    // Untouched sections survive.
    assert.match(updated, /## Notes/);
    assert.match(updated, /_\(nothing yet\)_/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appendCorrectionLogRows throws a clear error when the section is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "wfact-frontend-loop-test-"));
  const memoryPath = join(dir, "memory.md");
  writeFileSync(memoryPath, "# Client: x\n\n## Notes\n\nnothing\n", "utf-8");

  try {
    assert.throws(
      () => appendCorrectionLogRows(memoryPath, makeRounds(), "stage", "fixer"),
      /Correction-round log.*not found/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("formatCorrectionSummary compares against the DreamSign 40+ baseline honestly", () => {
  const under = formatCorrectionSummary(makeRounds(), true);
  assert.match(under, /2 correction round\(s\)/);
  assert.match(under, new RegExp(`${DREAMSIGN_BASELINE_ROUNDS}\\+ baseline`));
  assert.match(under, /Beats the baseline/);

  const overBaselineRounds: CorrectionRound[] = Array.from({ length: DREAMSIGN_BASELINE_ROUNDS + 1 }, (_, i) => ({
    round: i + 1,
    verdict: "changes_requested",
    issues: ["still rough"],
    timestamp: "2026-09-10T00:00:00Z",
  }));
  const over = formatCorrectionSummary(overBaselineRounds, false);
  assert.match(over, /Does not yet beat the baseline/);
});
