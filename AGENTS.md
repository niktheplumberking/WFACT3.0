# AGENTS.md

For any coding agent (Codex, Cursor, Gemini, Claude). This repo's canonical instructions are in [`CLAUDE.md`](CLAUDE.md), the
law file, plus the working rules in [`.claude/rules/`](.claude/rules/). Read them in that order before changing anything, then
`docs/HANDOFF.md` for orientation and the "Next up" list at the top of `PROGRESS.md` for the current task.

The short version: verify, do not trust "done"; one step at a time and wait for Huraira's GO; never push `main` (it deploys);
secrets by name only; stage named paths only (other sessions commit in this checkout); no root `package.json`, so run commands
inside each package (`.claude/QUICK_START.md`).
