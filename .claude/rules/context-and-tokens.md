# Context and token rules

Context is a budget: every line loaded is attention taken from the task. Load the least that lets you act correctly,
fetch more just in time. (Sources: Anthropic context-engineering guidance; CLAUDE.md/AGENTS.md practice, 2026.)

## What loads, and how to read the big files
- Always loaded: `CLAUDE.md`, `.claude/CLAUDE.md`, this folder. Everything else is read on demand.
- `PROGRESS.md` (~900 lines): read the top 60 lines, then only your step: `grep -n '^## Step 28' PROGRESS.md`, then read that range.
- `docs/WFACT-3.0-Factory-Completion-Plan.md` (~1,900 lines): read Part C once, then only your step's Part D section and Part E row.
- `docs/HANDOFF.md` is for orientation, not for every task. The Blueprint HTML: only the section a step cites.
- Codebase questions: `graphify query "<q>"` / `graphify explain` first; `GRAPH_REPORT.md` only for architecture reviews.

## Reading and searching
- Search before reading: `grep -n`, then `Read` with `offset`/`limit` (or `sed -n 'a,bp'`). No whole-file reads over ~400
  lines unless you are editing most of it.
- Never read: lockfiles, `node_modules/`, build output, PNG/PDF evidence, `graphify-out/cache/`, `docs/archive/`,
  `.claude/completions/`, `.claude/sessions/` (see `.claudeignore`; it is advisory, so this rule is what enforces it).
- Do not re-read a file you just wrote or edited; the edit tool already confirmed it.
- Trim command output at the source: `| head`, `| tail -20`, `--json | jq '.field'`, test reporters with summaries.
  Never dump a full CI log; fetch the failing job's last ~80 lines.

## Delegation and session shape
- Broad fan-out (many files, "where is X used") goes to a subagent that returns conclusions with `file:line`, not file dumps.
- One task per session. Compact at a breakpoint (after a verified step), not mid-edit. Hand off with a brief, not a transcript.

## Keeping always-loaded and tracker files small
- `CLAUDE.md` stays under ~200 lines; each rule file under ~60. A line earns its place only if removing it would cause a
  mistake. Procedures belong in skills (`.claude/skills/`), detail in `docs/`, linked by path.
- No timestamps or other per-session dynamic text in always-loaded files (it breaks prompt caching).
- `PROGRESS.md` top keeps "Last synced" plus at most two "Previous sync" lines. Sections of DONE steps move verbatim to
  `docs/archive/<date>-*/` with a `MANIFEST.md` row and a one-line pointer; status stays in Part E. Run
  `node scripts/check-trackers.mjs` after any such move.
