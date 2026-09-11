/**
 * Correction-round logging. Per the lessons ledger (`memory/lessons-ledger.md` #6): "DreamSign
 * took 40+ correction batches ... This is the number 3.0 has to beat with a real measurement, not
 * an opinion." This file is where that measurement gets written down, honestly, win or lose —
 * never rounded favorably, never silently dropped on a bad run.
 *
 * Importers: `src/cli.ts` (writes after each real run), `test/correctionLog.test.ts`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { CorrectionRound } from "./loop.js";

const DREAMSIGN_BASELINE_ROUNDS = 40;
const CORRECTION_LOG_HEADING = "## Correction-round log";
const TABLE_HEADER_ROW = "| Round | Stage | What was flagged | Fixed by | Date |";
const TABLE_SEPARATOR_ROW = "|---|---|---|---|---|";

export function formatCorrectionSummary(rounds: CorrectionRound[], approved: boolean): string {
  const count = rounds.length;
  const verdict = approved ? "approved" : "hit the round cap without approval (escalated)";
  return (
    `${count} correction round(s) logged this run (${verdict}), vs DreamSign 2.0's ` +
    `${DREAMSIGN_BASELINE_ROUNDS}+ baseline (memory/lessons-ledger.md #6). ` +
    `${count <= DREAMSIGN_BASELINE_ROUNDS ? "Beats" : "Does not yet beat"} the baseline on this run.`
  );
}

function formatRoundRow(round: CorrectionRound, stage: string, fixedBy: string): string {
  const flagged =
    round.verdict === "approved" ? "(approved, no issues)" : round.issues.join("; ") || "(unspecified)";
  const date = round.timestamp.slice(0, 10);
  return `| ${round.round} | ${stage} | ${flagged} | ${fixedBy} | ${date} |`;
}

/**
 * Appends this run's rounds as rows in a client memory file's existing "Correction-round log"
 * table (see `clients/_template/memory.md`). Path-scoped to `clients/`, matching the guard style
 * already established for memory reads in `packages/hermes/src/tools/memoryTools.ts` — this
 * writer only ever appends to a table that must already exist in the file, it never creates or
 * overwrites the rest of the memory file's content.
 */
export function appendCorrectionLogRows(
  memoryFilePath: string,
  rounds: CorrectionRound[],
  stage: string,
  fixedBy: string,
): void {
  const content = readFileSync(memoryFilePath, "utf-8");
  const headingIndex = content.indexOf(CORRECTION_LOG_HEADING);
  if (headingIndex === -1) {
    throw new Error(
      `"${CORRECTION_LOG_HEADING}" section not found in ${memoryFilePath} — expected the ` +
        "clients/_template/memory.md structure to already be present.",
    );
  }

  const afterHeading = content.slice(headingIndex);
  const nextHeadingMatch = afterHeading.slice(CORRECTION_LOG_HEADING.length).match(/\n## /);
  const sectionEnd = nextHeadingMatch
    ? headingIndex + CORRECTION_LOG_HEADING.length + nextHeadingMatch.index!
    : content.length;

  const section = content.slice(headingIndex, sectionEnd);
  const newRows = rounds.map((round) => formatRoundRow(round, stage, fixedBy)).join("\n");

  let updatedSection: string;
  if (section.includes(TABLE_HEADER_ROW)) {
    // Table already exists (even if empty) — append rows right after the separator row / existing rows.
    updatedSection = section.trimEnd() + "\n" + newRows + "\n";
  } else {
    // No table yet in this section — write header + separator + rows.
    updatedSection =
      section.trimEnd() + `\n\n${TABLE_HEADER_ROW}\n${TABLE_SEPARATOR_ROW}\n${newRows}\n`;
  }

  const updatedContent = content.slice(0, headingIndex) + updatedSection + content.slice(sectionEnd);
  writeFileSync(memoryFilePath, updatedContent, "utf-8");
}

export { DREAMSIGN_BASELINE_ROUNDS };
