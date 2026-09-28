# Graph Report - wfact-3.0-build  (2026-09-28)

## Corpus Check
- 122 files · ~92,256 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 612 nodes · 972 edges · 49 communities (30 shown, 18 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.84)
- Token cost: 250,052 input · 0 output

## Community Hubs (Navigation)
- Verification Checks
- Repo Law & CI
- Frontend Loop Builder
- Cockpit Rooms UI
- Cockpit Package Deps
- Hermes Package Deps
- Frontend-Loop Package Deps
- Hermes CLI & Model Client
- Hermes Controller & Escalation
- Verification Package Deps
- Cockpit TS Config
- Roadmap & Governance
- Blueprint & Stand-ins
- Fast-Track Plan & DoD
- Continuation Build Stages
- 2.0 Audit & Security Laws
- Supabase State Reader
- Hermes Memory Tools
- Frontend-Loop TS Config
- Hermes TS Config
- Verification TS Config
- Production Pipeline SOP
- Tool Allowlist Schema
- Init Schema Tables
- Playbook & Bake-off
- Entity Consistency Triggers
- RLS Policies v1
- Security Advisor Fixes
- RLS Recursion Fix
- Controller Test Fixtures
- Claude Hook: notification-token-display
- Claude Hook: post-write-token-diff
- Claude Hook: pre-tool-bash-guard
- Claude Hook: pre-tool-read-guard
- Claude Hook: pre-tool-token-guard
- Claude Hook: session-end-token-report
- Claude Hook: stop-path-guard
- Claude Hook: stop-session-snapshot
- Claude Hook: user-prompt-ghost-scanner
- Claude Hook: user-prompt-inject-context
- Claude Hook: user-prompt-inject-snapshot
- Claude Hook: user-prompt-validate-claude-md
- Schema Table Stub
- Schema Table Stub
- Usage/Cost Instrumentation
- Schema Table Stub
- Schema Table Stub
- Schema Table Stub

## God Nodes (most connected - your core abstractions)
1. `WFACT 3.0 Complete Ecosystem Blueprint` - 25 edges
2. `compilerOptions` - 16 edges
3. `WFACT 3.0 Fast-Track Plan` - 16 edges
4. `VerificationContext` - 13 edges
5. `FrontendLoop` - 12 edges
6. `Check` - 12 edges
7. `WFACT 3.0 Continuation Build Plan` - 12 edges
8. `ToolRegistry` - 11 edges
9. `WFACT 3.0 Law File (CLAUDE.md)` - 11 edges
10. `Hermes-lite (Phase 3 controller stand-in)` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Clean fixture page (passes all 6 checks)` --semantically_similar_to--> `DreamSign clean-agency page`  [INFERRED] [semantically similar]
  packages/verification/test/fixtures/clean.html → clients/dreamsign-pilot/pages/clean-agency.html
- `WFACT SOP 1 — Sales & Onboarding (md)` --semantically_similar_to--> `WFact SOP 1 — Sales & Onboarding (PDF)`  [INFERRED] [semantically similar]
  docs/WFACT SOPS/Claude outputs/WFACT-SOP-1-Sales-Onboarding.md → docs/WFACT SOPS/WFact SOP 1 — Sales & Onboarding (Lead to Signed).pdf
- `WFACT SOP 2 — Production Pipeline (md)` --semantically_similar_to--> `WFact SOP 2 — Production Pipeline (PDF)`  [INFERRED] [semantically similar]
  docs/WFACT SOPS/Claude outputs/WFACT-SOP-2-Production-Pipeline.md → docs/WFACT SOPS/WFact SOP 2 — Production Pipeline (Stages 1–8).pdf
- `WFACT SOP 3 — Post-Launch, Automation & Team Ops (md)` --semantically_similar_to--> `WFact SOP 3 — Post-Launch, Automation & Team Ops (PDF)`  [INFERRED] [semantically similar]
  docs/WFACT SOPS/Claude outputs/WFACT-SOP-3-Post-Launch-Automation-Team-Ops.md → docs/WFACT SOPS/WFact SOP 3 — Post-Launch, Automation & Team Operations.pdf
- `Connects is not works (anon key returns 0 rows)` --semantically_similar_to--> `Four verification statuses (never collapsed boolean)`  [INFERRED] [semantically similar]
  memory/lessons-ledger.md → packages/verification/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Proof sprint loop: controller -> memory -> front-end build -> verification -> cockpit** — packages_hermes_readme_hermes_lite, memory_context_business_context, clients_dreamsign_pilot_memory_first_live_run, packages_verification_readme_verification_loop, progress_cockpit_mvp [EXTRACTED 1.00]
- **Independent verification enforcement of 'never trust done'** — claude_never_trust_done_only_verified, packages_db_rls_attack_test_results_rls_attack_test, packages_verification_readme_verification_statuses, _github_workflows_ci_verification, claude_evaluator_independence [INFERRED 0.85]
- **Entity law enforcement across schema, memory and isolation check** — claude_entity_law, packages_db_rls_attack_test_results_entity_law_trigger, memory_context_entities, packages_verification_readme_six_deterministic_checks [INFERRED 0.85]
- **Never Trust Done, Only Verified: independent verification chain** — docs_wfact_3_0_continuation_build_plan_frontend_loop_pkg, docs_wfact_3_0_continuation_build_plan_verification_pkg, docs_wfact_3_0_ecosystem_blueprint_independent_evaluator, docs_wfact_3_0_fast_track_plan_the_eyes, docs_wfact_3_0_fast_track_plan_security_audit_50_point, docs_wfact_3_0_playbook_registry_78_check [INFERRED 0.85]
- **WFACT memory stack feeding Hermes** — docs_wfact_3_0_playbook_flat_file_memory, docs_wfact_3_0_playbook_tone_filter, docs_wfact_3_0_ecosystem_blueprint_hermes_controller, docs_wfact_3_0_ecosystem_blueprint_second_brain, docs_wfact_3_0_continuation_build_plan_episodic_memory_v1_5, docs_wfact_sops_claude_outputs_wfact_sop_3_post_launch_automation_team_ops_post_mortem_lessons_ledger [INFERRED 0.85]
- **Human-gated money and launch control** — docs_wfact_3_0_ecosystem_blueprint_three_approval_tiers, docs_wfact_sops_claude_outputs_wfact_sop_3_post_launch_automation_team_ops_autonomy_switchboard, docs_wfact_sops_claude_outputs_wfact_sop_2_production_pipeline_gate_principle, docs_wfact_sops_claude_outputs_wfact_sop_1_sales_onboarding_three_human_moments_stage0, docs_wfact_3_0_execution_roadmap_governance_split [INFERRED 0.85]

## Communities (49 total, 18 thin omitted)

### Community 0 - "Verification Checks"
Cohesion: 0.07
Nodes (39): imageOptimizationCheck, isolationCheck, noConsoleErrorsCheck, escapeRegExp(), requiredSectionsCheck, sectionPresent(), visibleText(), responsiveCheck (+31 more)

### Community 1 - "Repo Law & CI"
Cohesion: 0.05
Nodes (60): Architecture Map (template), graphify skill trigger, Common Mistakes (template), Quick Start Commands (template), CI build placeholder job (Phase 6), CI Workflow, CI frontend-loop job, CI guardrails job (gitleaks, law files, .env block) (+52 more)

### Community 2 - "Frontend Loop Builder"
Cohesion: 0.08
Nodes (29): InvalidBriefError, loadBrief(), parseBrief(), PilotBrief, REQUIRED_STRING_FIELDS, CLAUDE_PRICING_USD_PER_MTOK, main(), appendCorrectionLogRows() (+21 more)

### Community 3 - "Cockpit Rooms UI"
Cohesion: 0.12
Nodes (21): App(), Room, ROOMS, Stats, useStats(), Approvals(), approve(), load() (+13 more)

### Community 4 - "Cockpit Package Deps"
Cohesion: 0.07
Nodes (27): dependencies, react, react-dom, @supabase/supabase-js, description, devDependencies, @types/react, @types/react-dom (+19 more)

### Community 5 - "Hermes Package Deps"
Cohesion: 0.08
Nodes (23): dependencies, @anthropic-ai/sdk, @supabase/supabase-js, zod, description, devDependencies, tsx, @types/node (+15 more)

### Community 6 - "Frontend-Loop Package Deps"
Cohesion: 0.10
Nodes (19): dependencies, @anthropic-ai/sdk, description, devDependencies, tsx, @types/node, typescript, @anthropic-ai/sdk (+11 more)

### Community 7 - "Hermes CLI & Model Client"
Cohesion: 0.14
Nodes (11): main(), PRICING_USD_PER_MTOK, HermesLite, HermesLiteOptions, ClaudeModelClient, MockModelClient, ModelClient, modelClientFromEnv() (+3 more)

### Community 8 - "Hermes Controller & Escalation"
Cohesion: 0.18
Nodes (12): detectEntitySlug(), HermesAnswer, KNOWN_ENTITIES, EscalationError, RetryOptions, withBoundedRetry(), applyToneFilter(), buildPlainLanguageSystemPrompt() (+4 more)

### Community 9 - "Verification Package Deps"
Cohesion: 0.10
Nodes (19): dependencies, @anthropic-ai/sdk, description, devDependencies, tsx, @types/node, typescript, @anthropic-ai/sdk (+11 more)

### Community 10 - "Cockpit TS Config"
Cohesion: 0.11
Nodes (17): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 11 - "Roadmap & Governance"
Cohesion: 0.15
Nodes (18): Dependency-Gated Stages, Three Approval Tiers (auto-pass, notify-and-wait, hard-gate), WFACT 3.0 Execution Roadmap, Governance: who decides what (Nick, Huraira, Atif, Toby), Operating Principles (verify don't trust, revenue before optimization, one loop before parallel), Roadmap Risk Register, Success Metrics, Agent 37 Free-Models-First Routing Rule (+10 more)

### Community 12 - "Blueprint & Stand-ins"
Cohesion: 0.18
Nodes (17): Documentation Index, WFACT 3.0 Ecosystem Blueprint (HTML), Hermes-lite (packages/hermes), Stand-in Disclosure Rule, WFACT 3.0 Complete Ecosystem Blueprint, Blueprint Build Order (Phases 0-12), Cockpit / Control Room 3.0, Cognee (second brain candidate) (+9 more)

### Community 13 - "Fast-Track Plan & DoD"
Cohesion: 0.16
Nodes (16): Definition of Done (§16K), Execution Roadmap Phases 0-4 (Foundation to SaaS Readiness), WFACT 3.0 Fast-Track Plan, Cockpit MVP: Pipeline, Approvals, Runs, Correction-Round Count Metric, Fast-Track Sequence (5 steps: smoke test to proof run), Five Done Conditions ("best quality, 100%"), Proof Run and Handoff (+8 more)

### Community 14 - "Continuation Build Stages"
Cohesion: 0.19
Nodes (14): WFACT 3.0 Continuation Build Plan, Generalized Agent Runtime (spawn/execute/report/terminate), Episodic Memory v1.5 tied to task IDs, Front-End Loop (packages/frontend-loop), Observability Seed (audit_log table), Verification Loop (packages/verification), Workflow Engine v1 (build to verify pipeline), Checkpoint and Rollback on Failure (+6 more)

### Community 15 - "2.0 Audit & Security Laws"
Cohesion: 0.24
Nodes (14): Template-First Doctrine, Audit: WFACT 2.0 to 3.0 (KEEP/REPLACE classification), 50-Point Security Audit, WFACT 3.0 Progress Report (for Nick), RLS Isolation Attack Test, WFACT SOP 1 — Sales & Onboarding (md), Amir (2.0 AI chief of staff), Entity Law (DreamSign, Bennett & Co, Rizm/bridge) (+6 more)

### Community 16 - "Supabase State Reader"
Cohesion: 0.21
Nodes (8): main(), StateReader, stateReaderFromEnv(), SupabaseStateReader, ToolDefinition, createProjectStatusTool(), projectStatusInput, projectStatusOutput

### Community 17 - "Hermes Memory Tools"
Cohesion: 0.22
Nodes (8): readClientInput, readClientMemoryTool, readClientOutput, readContextInput, readContextOutput, readContextTool, buildToolRegistry(), ToolRegistry

### Community 18 - "Frontend-Loop TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 19 - "Hermes TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 20 - "Verification TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 21 - "Production Pipeline SOP"
Cohesion: 0.31
Nodes (11): The Eyes (scroll-record, frame review, jank test <50ms), WFACT SOP 2 — Production Pipeline (md), Concept Pitch (2-3 named concepts), Stage 5 Direction Lock, 11-Stage Client Pipeline (Stages 0-10), Experience Mode (standard-cinematic, scroll-film-A/B), Gate Principle (honest pass/fail per stage), Hosting Law (Hostinger live, Vercel previews only) (+3 more)

### Community 22 - "Tool Allowlist Schema"
Cohesion: 0.29
Nodes (5): ToolInputValidationError, ToolNotAllowlistedError, ToolOutputValidationError, echoTool, zod

### Community 23 - "Init Schema Tables"
Cohesion: 0.44
Nodes (8): auth.users, public.clients, public.correction_rounds, public.entities, public.profile_clients, public.profiles, public.projects, public.tasks

### Community 24 - "Playbook & Bake-off"
Cohesion: 0.25
Nodes (9): WFACT 3.0 Build Playbook, Claude Code vs Codex Bake-off, 78-Check Feature Registry, Status Tags (CARRIED OVER, DECIDED, RECOMMENDED, TO TEST, OPEN), Plain-English Tone Filter, Vercel Hobby Serverless Function Ceiling (12/12), WFact Factory Audit (PDF), WFACT 2.0 Factory Book (PDF) (+1 more)

### Community 25 - "Entity Consistency Triggers"
Cohesion: 0.22
Nodes (8): public.enforce_project_entity_matches_client(), public.enforce_task_entity_matches_project(), public.clients, public.projects, trg_project_entity_consistency, trg_task_entity_consistency, public.enforce_project_entity_matches_client, public.enforce_task_entity_matches_project

### Community 26 - "RLS Policies v1"
Cohesion: 0.40
Nodes (5): public.assigned_client_ids(), public.current_role_name(), public.is_owner_or_admin(), public.profile_clients, public.profiles

### Community 27 - "Security Advisor Fixes"
Cohesion: 0.40
Nodes (5): public.assigned_client_ids(), public.current_role_name(), public.is_owner_or_admin(), public.profile_clients, public.profiles

### Community 28 - "RLS Recursion Fix"
Cohesion: 0.40
Nodes (5): private.assigned_client_ids(), private.current_role_name(), private.is_owner_or_admin(), public.profile_clients, public.profiles

### Community 29 - "Controller Test Fixtures"
Cohesion: 0.47
Nodes (3): ProjectStatusRow, fakeRows, FakeStateReader

## Ambiguous Edges - Review These
- `Documentation Index` → `WFACT 3.0 Complete Ecosystem Blueprint`  [AMBIGUOUS]
  docs/INDEX.md · relation: conceptually_related_to
- `WFACT SOP (PDF)` → `WFact SOP 1 — Sales & Onboarding (PDF)`  [AMBIGUOUS]
  docs/WFACT SOPS/WFACT SOP.pdf · relation: conceptually_related_to

## Knowledge Gaps
- **192 isolated node(s):** `notification-token-display.sh script`, `post-write-token-diff.sh script`, `pre-tool-bash-guard.sh script`, `pre-tool-read-guard.sh script`, `pre-tool-token-guard.sh script` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 272 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Documentation Index` and `WFACT 3.0 Complete Ecosystem Blueprint`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `WFACT SOP (PDF)` and `WFact SOP 1 — Sales & Onboarding (PDF)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `zod` connect `Tool Allowlist Schema` to `Supabase State Reader`, `Hermes Memory Tools`, `Hermes Package Deps`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `WFACT 3.0 Complete Ecosystem Blueprint` connect `Blueprint & Stand-ins` to `Roadmap & Governance`, `Fast-Track Plan & DoD`, `Continuation Build Stages`, `2.0 Audit & Security Laws`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `WFACT 3.0 Fast-Track Plan` connect `Fast-Track Plan & DoD` to `Roadmap & Governance`, `Blueprint & Stand-ins`, `2.0 Audit & Security Laws`, `Production Pipeline SOP`, `Playbook & Bake-off`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `notification-token-display.sh script`, `post-write-token-diff.sh script`, `pre-tool-bash-guard.sh script` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Verification Checks` be split into smaller, more focused modules?**
  _Cohesion score 0.068997668997669 - nodes in this community are weakly interconnected._