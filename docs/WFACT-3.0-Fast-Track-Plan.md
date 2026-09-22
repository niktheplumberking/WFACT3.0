# WFACT 3.0: The Fast-Track Plan

For Huraira and the coding agent working the build. Read once, then work it top to bottom. This is the plan that gets picked up from `PROGRESS.md`'s current state and carries it through to a real, launched, verified proof run, as fast as the code can honestly go, without cutting the one corner 2.0 already proved is expensive to cut: shipping something unverified and calling it done.

Last updated: September 21, 2026.

---

## 1. What "best quality, 100%" actually means here

Not a feeling, a checklist. WFACT 3.0 is done with this sprint when all five of these are true, not when it feels close:

- One real client (or the DreamSign placeholder, if a real brief still hasn't arrived) goes all the way through the pipeline on the new stack and launches for real, not to a local file.
- The correction-round count for that build is logged honestly and compared against 2.0's number: 40+ batches on dreamsign.rs, 26+ on Nick's own front-end complaint. Going down is the actual proof 3.0 improved anything. A good feeling is not proof.
- Every check that catches a broken build (the six deterministic checks plus the independent evaluator) has been run against something real, not just against a mock in a unit test.
- A real per-client API cost number exists, logged from an actual run. 2.0 never measured this. It stays UNVERIFIED until it's real.
- Nothing ships past a security or QA gate on a self-report. The agent that built a piece of work is never the only thing that checked it.

If a step is fast but skips one of these five, it is not fast, it is 2.0's biggest mistake again wearing a new date.

---

## 2. Where the build actually stands right now

Straight from `PROGRESS.md`, as of today:

Phases 1 through 3 are built and independently verified (Hermes-lite passes 26 of 26 tests, the RLS isolation attack test passes for real against a live sandbox database). Phase 4's build loop is fully coded and unit-tested, 20 of 20 passing, but has never touched a real API. Phase 5's deterministic checks are proven for real against a deliberately broken fixture; its live evaluator run has never happened. Phases 6 and 7 haven't started.

Every one of those gaps traced back to the same single cause: no live API key. That's gone now. Anthropic and OpenAI keys, GitHub, Supabase, Vercel, Hostinger, 21st.dev, Motion Sites, Agent 37, and the three SOPs plus the Ops Manual are all in hand and confirmed. There is no access blocker left standing between the code that's already written and a real run. From here, the work is running it, not waiting for it.

---

## 3. The rule for every model call from here on

Budget is thin and real: a $10 top-up on Anthropic, $0 on OpenAI, both self-funded for now. So the routing rule for the agent is fixed, not a judgment call per step:

Default every call to Agent 37's built-in free models first. Only call out to Anthropic or OpenAI when a step genuinely needs the extra quality a free model can't deliver, the same logic the $50 cost-pause rule already runs on. Log the real cost of every paid call as it happens, this is also how the $50 estimate stops being a guess. Before running the Anthropic-versus-OpenAI bake-off specifically, stop and flag that OpenAI's balance needs a top-up first. Don't burn it on anything else by accident.

---

## 4. The fast-track sequence: run this, in order

This is the literal task list for the coding agent. Each step only starts once the one before it is genuinely done, not attempted.

### Step 1 — Phase 3's live smoke test (unblocks everything after it)

Run Hermes-lite's CLI against a real status question, using the real `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` that now exist. Confirm the answer is correct, grounded in real memory and state, and in plain language, not a canned response. This is Phase 3's own exit check, unmet until now for exactly one reason that no longer applies.

Exit check: a real question gets a real, correct, plain-language answer, sourced from the actual database and memory files.

### Step 2 — Phase 4's first live build

Run the front-end loop for real, on the DreamSign placeholder brief unless a real one has landed by now. Two upgrades to make here, not just an unblock: wire in Motion Sites MCP and 21st.dev MCP for real, replacing the three hand-picked templates that were only ever a fallback, since access to both is no longer the open item it was. Log every single correction round, this number is the entire point of the exercise.

Exit check: one real page, actually built through the loop, with an honest correction-round count logged next to it.

### Step 3 — Phase 5's live verification

Run the verification CLI against the real page Step 2 just produced, as a genuinely separate step from the build itself. Run the live evaluator too, not the mocked version the unit tests use. If the deliberately-broken-fixture test already proved the six checks catch a bad build, this step proves they catch (or clear) a real one.

Exit check: the real Phase 4 page has been checked by something other than the agent that built it, and the result is logged, pass or fail either way.

### Step 4 — Cockpit MVP, just enough to run a project

Not the full 2.0 room list. Three rooms: Pipeline, Approvals, Runs. That's what's needed to actually run a client through the pipeline end to end, everything else in the original 11-room Cockpit can wait. This can start in parallel with Step 2 and 3, it doesn't depend on either.

Exit check: a project can be moved through its stages and a gate can be approved, from inside the Cockpit, not from a script.

### Step 5 — Proof run and handoff

One real client (or DreamSign again if nothing else is ready) goes through the whole pipeline on the new stack, start to launch, for real. This is where Section 1's five conditions all get checked off together, not separately.

Exit check: a site is actually live, the correction-round count is logged and compared against 2.0's 40+, the security audit has run against the shipped build, and a real cost number exists for the whole run.

---

## 5. The quality gates that don't get skipped, ever, no matter how fast this needs to go

These are proven, not theoretical, 2.0 paid to learn every one of them:

Never auto-advance a stage. Gates move on an honest pass or fail check against reality, never on a guess that it's probably fine. The agent can carry a stage headlessly but can never pass a human gate by itself, it logs the blocker and stops.

The Eyes, before any human sees a link: scroll-record the build, watch it frame by frame forward and backward, run the jank test (worst frame under 50 milliseconds, never judged on an average). This is what "eyes before humans" means, and it's what caught real defects in 2.0 that a glance would have missed.

The 50-point security audit runs before anything ships, factory-built or hand-built, no exceptions. Three items stay honestly marked NOT COVERED (auth bypass, session attacks, rate-limit bypass) rather than quietly claimed as handled.

Any new data boundary gets an actual attack test, not an assumption. Log in as one client, try to reach another client's data for real. That's how the RLS isolation guarantee got proven the first time, same standard applies to anything new.

Real content only. Missing content gets chased the day it's first noticed, never faked to keep a stage moving.

Commit and push after every completed section. An uncommitted day of work is 2.0's second most expensive lesson, right behind the pack that was silently never installed.

---

## 6. What NOT to carry forward from 2.0, on purpose, even under time pressure

Speed is exactly when these mistakes creep back in quietly, so they're named here directly:

Don't trust an install just because it was delivered. The 2.0 book's single biggest root cause was a whole feature pack that silently never installed, verify with the same registry pattern that caught it, on anything new.

Don't let the architecture keep changing mid-build. 2.0's doctrine churn (Experience Charter demoted, then the Director process replaced, then retired) cost real time for no shipped benefit. Decide once per phase, then build.

Don't build a screen nobody will click yet. Several 2.0 Cockpit panels were fully built and never verified in production because nobody actually used them. Step 4 above is deliberately three rooms, not eleven, for this exact reason.

Don't run parallel client loops before one loop is proven. One clean, verified run first. Multiplying an unproven process just multiplies its defects.

---

## 7. Kickoff: hand this straight to the coding agent

Paste this as the opening instruction for the next coding agent session:

> Work `WFACT-3.0-Fast-Track-Plan.md` top to bottom, one step at a time. Every access item and API key that used to block this sprint is now in hand, there is nothing left to wait on. Default every model call to Agent 37's free models first, only use Anthropic or OpenAI when a step genuinely needs it, and log the real cost of every paid call. Start at Step 1. Do not mark a step done until its exit check has actually passed, not attempted, and never let the same agent that built a piece of work be the only thing that checks it. When you hit a real blocker, stop, log it plainly in `BLOCKED-ON-NICK.md` or `PROGRESS.md`, and say so, don't work around a gate.

---

## 8. After the proof run

Once Step 5's exit check is fully met, this sprint's job is done and the next one starts, per the Execution Roadmap's own Phase 2: run a second and third client through the same pipeline, to prove it repeats and wasn't a one-time clean run. Don't start that until Step 5 is genuinely closed, not just close.

---

*Builds on `PROGRESS.md`, the Operator's Manual, the Execution Roadmap, the Ecosystem Blueprint, the Replan, and the three WFACT 2.0 SOPs plus the Factory Book audit now confirmed in hand. Where this page and an earlier document disagree on sequencing, this page is the current one to follow, it exists specifically to fast-track from here.*
