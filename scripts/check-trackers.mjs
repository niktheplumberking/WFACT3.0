#!/usr/bin/env node
// check-trackers.mjs — independent check that PROGRESS.md and the Factory Completion Plan
// agree with each other and are not behind the code.
//
// Checks:
//   1. Every Part D heading "### STEP N — ... — <STATUS>" matches its Part E row status.
//   2. Every "## Step N — ... (<STATUS> ...)" section in PROGRESS.md matches the Part E row status.
//   3. Staleness: no commit after the last tracker commit touches code paths, unless its
//      message carries [no-tracker].
//
// Usage: node scripts/check-trackers.mjs [--no-staleness] [--json]
// Exit 0 = consistent, 1 = drift found, 2 = could not parse.
// No dependencies; runs from the repo root (there is no root package.json on purpose).

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PLAN = 'docs/WFACT-3.0-Factory-Completion-Plan.md';
const PROGRESS = 'PROGRESS.md';
const CODE_PATHS = ['apps', 'packages', 'scripts', '.github', 'clients'];
const STATUSES = ['BUILT AND DEPLOYED', 'IN PROGRESS', 'NOT STARTED', 'PARTIAL', 'BLOCKED', 'DONE'];

const args = new Set(process.argv.slice(2));
const problems = [];

// The status that appears first in the text ("**DONE** (job ...)", "DONE 2026-09-30", "not started").
function statusOf(text) {
  const t = text.replace(/\*/g, '').toUpperCase();
  let best = null;
  let bestAt = Infinity;
  for (const s of STATUSES) {
    const at = t.indexOf(s);
    if (at !== -1 && at < bestAt) { best = s; bestAt = at; }
  }
  return best;
}

let plan, progress;
try {
  plan = readFileSync(PLAN, 'utf8');
  progress = readFileSync(PROGRESS, 'utf8');
} catch (e) {
  console.error(`check-trackers: cannot read trackers (${e.message}); run from the repo root`);
  process.exit(2);
}

// Part E checklist rows: | 4B | Name | **STATUS** ... | date | approved |
const partE = plan.split(/^## Part E/m)[1];
if (!partE) { console.error('check-trackers: Part E not found in the plan'); process.exit(2); }
const rows = new Map();
for (const line of partE.split('\n')) {
  if (/^\*\*Goal tracker/.test(line)) break;
  const m = line.match(/^\|\s*(\d+[A-Z]?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
  if (m) rows.set(m[1], { name: m[2], status: statusOf(m[3]) });
}
if (rows.size === 0) { console.error('check-trackers: no Part E rows parsed'); process.exit(2); }

// 1. Part D headings vs Part E. The status is the last " — " segment of the heading.
const headings = [...plan.matchAll(/^### STEP (\d+[A-Z]?) — (.+)$/gm)];
for (const [, id, rest] of headings) {
  const parts = rest.split(' — ');
  const headingStatus = parts.length > 1 ? statusOf(parts.at(-1)) : null;
  const row = rows.get(id);
  if (!row) { problems.push(`Step ${id}: heading in Part D but no row in Part E`); continue; }
  if (!headingStatus) { problems.push(`Step ${id}: Part D heading has no status suffix`); continue; }
  if (headingStatus !== row.status) {
    problems.push(`Step ${id}: Part D heading says ${headingStatus}, Part E row says ${row.status ?? '(none)'}`);
  }
}
for (const id of rows.keys()) {
  if (!headings.some(([, h]) => h === id)) problems.push(`Step ${id}: row in Part E but no heading in Part D`);
}

// 2. PROGRESS.md step sections vs Part E.
for (const [, id, paren] of progress.matchAll(/^## Step (\d+[A-Z]?) — .*?\(([^)]*)\)/gm)) {
  const row = rows.get(id);
  const s = statusOf(paren);
  if (!row) { problems.push(`PROGRESS.md: section for Step ${id} but no Part E row`); continue; }
  if (s && s !== row.status) problems.push(`Step ${id}: PROGRESS.md section says ${s}, Part E row says ${row.status}`);
}

// 3. Staleness against git.
let stale = [];
if (!args.has('--no-staleness')) {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
  try {
    const lastTracker = git('log', '-1', '--format=%H', '--', PROGRESS, PLAN);
    if (lastTracker) {
      const out = git('log', `${lastTracker}..HEAD`, '--format=%h%x09%s', '--', ...CODE_PATHS);
      stale = out ? out.split('\n').filter((l) => !l.includes('[no-tracker]')) : [];
      if (stale.length) {
        problems.push(
          `Trackers are behind the code: ${stale.length} commit(s) touch ${CODE_PATHS.join('/')} after the last tracker update ` +
          `(${lastTracker.slice(0, 7)}):\n    ` + stale.join('\n    '),
        );
      }
    }
  } catch (e) {
    problems.push(`staleness check skipped: git failed (${e.message.split('\n')[0]})`);
  }
}

if (args.has('--json')) {
  console.log(JSON.stringify({ ok: problems.length === 0, problems, staleCommits: stale }, null, 2));
} else if (problems.length === 0) {
  console.log(`check-trackers: OK (${rows.size} steps; Part D, Part E and PROGRESS.md agree; trackers not behind the code)`);
} else {
  console.log(`check-trackers: ${problems.length} problem(s)`);
  for (const p of problems) console.log(`  - ${p}`);
}
process.exit(problems.length === 0 ? 0 : 1);
