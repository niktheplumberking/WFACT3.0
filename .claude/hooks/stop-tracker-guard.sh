#!/bin/bash
# stop-tracker-guard.sh
# EVENT: Stop
# DESCRIPTION: Keep PROGRESS.md and the Factory Completion Plan in step with the code.
#
# Runs scripts/check-trackers.mjs when the agent tries to end its turn. If code was committed
# after the last tracker update, or the two trackers disagree on a step's status, the stop is
# blocked once and the agent is told to run the /step-close procedure
# (.claude/skills/step-close/SKILL.md). If the agent stops again in the same turn
# (stop_hook_active = true) the hook lets it through, so it can never loop.
#
# Opt out per commit: put [no-tracker] in the commit message (trivial fixes, tracker-only work).
# Opt out per session: WFACT_TRACKER_GUARD=off.

[ "${WFACT_TRACKER_GUARD:-on}" = "off" ] && exit 0

INPUT=$(cat)
ACTIVE=$(printf '%s' "$INPUT" | python3 -c "import sys,json
try: print(str(json.load(sys.stdin).get('stop_hook_active', False)).lower())
except Exception: print('false')" 2>/dev/null)
[ "$ACTIVE" = "true" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f scripts/check-trackers.mjs ] || exit 0
command -v node >/dev/null 2>&1 || exit 0

REPORT=$(node scripts/check-trackers.mjs 2>&1)
STATUS=$?
[ $STATUS -eq 0 ] && exit 0

REASON="Tracker guard: PROGRESS.md / docs/WFACT-3.0-Factory-Completion-Plan.md are out of date or disagree.

$REPORT

Before stopping, follow .claude/skills/step-close/SKILL.md (/step-close <step id>): update both trackers from verified evidence, run node scripts/check-trackers.mjs until it says OK, and commit the two files by name. If these commits really need no tracker entry, say so and why in your reply instead."

python3 -c "import json,sys; print(json.dumps({'decision':'block','reason':sys.argv[1]}))" "$REASON"
exit 0
