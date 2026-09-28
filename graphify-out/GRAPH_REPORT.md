# Graph Report - wfact-3.0-build  (2026-09-28)

## Corpus Check
- 158 files · ~119,764 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1142 nodes · 1760 edges · 74 communities (52 shown, 21 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1bcf6717`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verificationLoop.ts
- WFACT 3.0 Law File (CLAUDE.md)
- frontend-loop/src/agent.ts
- App.tsx
- cockpit/package.json
- hermes/package.json
- frontend-loop/package.json
- hermes/src/cli.ts
- controller.ts
- verification/package.json
- compilerOptions
- WFACT 3.0 Execution Roadmap
- WFACT 3.0 Complete Ecosystem Blueprint
- WFACT 3.0 Fast-Track Plan
- WFACT 3.0 Continuation Build Plan
- Audit: WFACT 2.0 to 3.0 (KEEP/REPLACE classification)
- tools/registry.ts
- 0008_model_traces.sql
- compilerOptions
- compilerOptions
- compilerOptions
- WFACT SOP 2 — Production Pipeline (md)
- ToolRegistry
- 0001_init_schema.sql
- WFACT 3.0 Build Playbook
- 0002_entity_consistency_triggers.sql
- 0003_rls_policies.sql
- 0004_security_advisor_fixes.sql
- 0005_fix_rls_recursion.sql
- What You Must Do When Invoked
- notification-token-display.sh
- post-write-token-diff.sh
- pre-tool-bash-guard.sh
- pre-tool-read-guard.sh
- pre-tool-token-guard.sh
- session-end-token-report.sh
- stop-path-guard.sh
- stop-session-snapshot.sh
- user-prompt-ghost-scanner.sh
- user-prompt-inject-context.sh
- user-prompt-inject-snapshot.sh
- user-prompt-validate-claude-md.sh
- public.clients
- public.projects
- Usage/cost instrumentation (totalUsage)
- public.correction_rounds
- public.entities
- public.tasks
- audit/src/index.ts
- audit/package.json
- compilerOptions
- graphify reference: extra exports and benchmark
- graphify reference: query, path, explain
- 0006_audit_log.sql
- vercel.json
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- extraction-spec.md
- agent-runtime/src/index.ts
- agent-runtime/package.json
- compilerOptions
- buildAndVerify.ts
- workflow/package.json
- compilerOptions
- @wfact/workflow — build → verify (Continuation Plan Stage 3)
- planner.ts
- planning/package.json
- compilerOptions
- routing.ts
- 0007_plan_approvals.sql

## God Nodes (most connected - your core abstractions)
1. `WFACT 3.0 Complete Ecosystem Blueprint` - 25 edges
2. `VerificationContext` - 17 edges
3. `compilerOptions` - 16 edges
4. `ToolRegistry` - 16 edges
5. `WFACT 3.0 Fast-Track Plan` - 16 edges
6. `FrontendLoop` - 14 edges
7. `Check` - 14 edges
8. `WFACT 3.0 Continuation Build Plan` - 14 edges
9. `PilotBrief` - 12 edges
10. `What You Must Do When Invoked` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Clean fixture page (passes all 6 checks)` --semantically_similar_to--> `DreamSign clean-agency page`  [INFERRED] [semantically similar]
  packages/verification/test/fixtures/clean.html → clients/dreamsign-pilot/pages/clean-agency.html
- `WFACT SOP 3 — Post-Launch, Automation & Team Ops (md)` --semantically_similar_to--> `WFact SOP 3 — Post-Launch, Automation & Team Ops (PDF)`  [INFERRED] [semantically similar]
  docs/WFACT SOPS/Claude outputs/WFACT-SOP-3-Post-Launch-Automation-Team-Ops.md → docs/WFACT SOPS/WFact SOP 3 — Post-Launch, Automation & Team Operations.pdf
- `WFACT SOP 1 — Sales & Onboarding (md)` --semantically_similar_to--> `WFact SOP 1 — Sales & Onboarding (PDF)`  [INFERRED] [semantically similar]
  docs/WFACT SOPS/Claude outputs/WFACT-SOP-1-Sales-Onboarding.md → docs/WFACT SOPS/WFact SOP 1 — Sales & Onboarding (Lead to Signed).pdf
- `WFACT SOP 2 — Production Pipeline (md)` --semantically_similar_to--> `WFact SOP 2 — Production Pipeline (PDF)`  [INFERRED] [semantically similar]
  docs/WFACT SOPS/Claude outputs/WFACT-SOP-2-Production-Pipeline.md → docs/WFACT SOPS/WFact SOP 2 — Production Pipeline (Stages 1–8).pdf
- `Connects is not works (anon key returns 0 rows)` --semantically_similar_to--> `Four verification statuses (never collapsed boolean)`  [INFERRED] [semantically similar]
  memory/lessons-ledger.md → packages/verification/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Proof sprint loop: controller -> memory -> front-end build -> verification -> cockpit** — packages_hermes_readme_hermes_lite, memory_context_business_context, clients_dreamsign_pilot_memory_first_live_run, packages_verification_readme_verification_loop, progress_cockpit_mvp [EXTRACTED 1.00]
- **Entity law enforcement across schema, memory and isolation check** — claude_entity_law, packages_db_rls_attack_test_results_entity_law_trigger, memory_context_entities, packages_verification_readme_six_deterministic_checks [INFERRED 0.85]
- **Human-gated money and launch control** — docs_wfact_3_0_ecosystem_blueprint_three_approval_tiers, docs_wfact_sops_claude_outputs_wfact_sop_3_post_launch_automation_team_ops_autonomy_switchboard, docs_wfact_sops_claude_outputs_wfact_sop_2_production_pipeline_gate_principle, docs_wfact_sops_claude_outputs_wfact_sop_1_sales_onboarding_three_human_moments_stage0, docs_wfact_3_0_execution_roadmap_governance_split [INFERRED 0.85]
- **Independent verification enforcement of 'never trust done'** — claude_never_trust_done_only_verified, packages_db_rls_attack_test_results_rls_attack_test, packages_verification_readme_verification_statuses, _github_workflows_ci_verification, claude_evaluator_independence [INFERRED 0.85]
- **Never Trust Done, Only Verified: independent verification chain** — docs_wfact_3_0_continuation_build_plan_frontend_loop_pkg, docs_wfact_3_0_continuation_build_plan_verification_pkg, docs_wfact_3_0_ecosystem_blueprint_independent_evaluator, docs_wfact_3_0_fast_track_plan_the_eyes, docs_wfact_3_0_fast_track_plan_security_audit_50_point, docs_wfact_3_0_playbook_registry_78_check [INFERRED 0.85]
- **WFACT memory stack feeding Hermes** — docs_wfact_3_0_playbook_flat_file_memory, docs_wfact_3_0_playbook_tone_filter, docs_wfact_3_0_ecosystem_blueprint_hermes_controller, docs_wfact_3_0_ecosystem_blueprint_second_brain, docs_wfact_3_0_continuation_build_plan_episodic_memory_v1_5, docs_wfact_sops_claude_outputs_wfact_sop_3_post_launch_automation_team_ops_post_mortem_lessons_ledger [INFERRED 0.85]

## Communities (74 total, 21 thin omitted)

### Community 0 - "verificationLoop.ts"
Cohesion: 0.06
Nodes (44): createQaEvaluatorAgent(), QA_EVALUATOR_ROLE, QaEvaluatorAgentOptions, QaInput, imageOptimizationCheck, isolationCheck, noConsoleErrorsCheck, escapeRegExp() (+36 more)

### Community 1 - "WFACT 3.0 Law File (CLAUDE.md)"
Cohesion: 0.05
Nodes (60): Architecture Map (template), graphify skill trigger, Common Mistakes (template), Quick Start Commands (template), CI build placeholder job (Phase 6), CI Workflow, CI frontend-loop job, CI guardrails job (gitleaks, law files, .env block) (+52 more)

### Community 2 - "frontend-loop/src/agent.ts"
Cohesion: 0.08
Nodes (34): createFrontendBuilderAgent(), FRONT_END_BUILDER_ROLE, FrontendBuilderAgentOptions, FrontendBuildInput, BRIEF_SOURCES, InvalidBriefError, loadBrief(), parseBrief() (+26 more)

### Community 3 - "App.tsx"
Cohesion: 0.08
Nodes (32): App(), Room, ROOMS, Stats, useStats(), Approvals(), approve(), load() (+24 more)

### Community 4 - "cockpit/package.json"
Cohesion: 0.07
Nodes (27): dependencies, react, react-dom, @supabase/supabase-js, description, devDependencies, @types/react, @types/react-dom (+19 more)

### Community 5 - "hermes/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @anthropic-ai/sdk, @supabase/supabase-js, @wfact/audit, zod, description, devDependencies, tsx (+23 more)

### Community 6 - "frontend-loop/package.json"
Cohesion: 0.07
Nodes (26): dependencies, @anthropic-ai/sdk, @wfact/agent-runtime, @wfact/audit, @wfact/hermes-lite, description, devDependencies, tsx (+18 more)

### Community 7 - "hermes/src/cli.ts"
Cohesion: 0.14
Nodes (13): main(), HermesLite, HermesLiteOptions, ClaudeModelClient, MockModelClient, ModelClient, modelClientFromEnv(), ModelNotConfiguredError (+5 more)

### Community 8 - "controller.ts"
Cohesion: 0.18
Nodes (12): detectEntitySlug(), HermesAnswer, KNOWN_ENTITIES, EscalationError, RetryOptions, withBoundedRetry(), applyToneFilter(), buildPlainLanguageSystemPrompt() (+4 more)

### Community 9 - "verification/package.json"
Cohesion: 0.07
Nodes (26): dependencies, @anthropic-ai/sdk, @wfact/agent-runtime, @wfact/audit, @wfact/hermes-lite, description, devDependencies, tsx (+18 more)

### Community 10 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 11 - "WFACT 3.0 Execution Roadmap"
Cohesion: 0.15
Nodes (18): Dependency-Gated Stages, Three Approval Tiers (auto-pass, notify-and-wait, hard-gate), WFACT 3.0 Execution Roadmap, Governance: who decides what (Nick, Huraira, Atif, Toby), Operating Principles (verify don't trust, revenue before optimization, one loop before parallel), Roadmap Risk Register, Success Metrics, Agent 37 Free-Models-First Routing Rule (+10 more)

### Community 12 - "WFACT 3.0 Complete Ecosystem Blueprint"
Cohesion: 0.18
Nodes (17): Documentation Index, WFACT 3.0 Ecosystem Blueprint (HTML), Hermes-lite (packages/hermes), Stand-in Disclosure Rule, WFACT 3.0 Complete Ecosystem Blueprint, Blueprint Build Order (Phases 0-12), Cockpit / Control Room 3.0, Cognee (second brain candidate) (+9 more)

### Community 13 - "WFACT 3.0 Fast-Track Plan"
Cohesion: 0.16
Nodes (16): Definition of Done (§16K), Execution Roadmap Phases 0-4 (Foundation to SaaS Readiness), WFACT 3.0 Fast-Track Plan, Cockpit MVP: Pipeline, Approvals, Runs, Correction-Round Count Metric, Fast-Track Sequence (5 steps: smoke test to proof run), Five Done Conditions ("best quality, 100%"), Proof Run and Handoff (+8 more)

### Community 14 - "WFACT 3.0 Continuation Build Plan"
Cohesion: 0.19
Nodes (14): WFACT 3.0 Continuation Build Plan, Generalized Agent Runtime (spawn/execute/report/terminate), Episodic Memory v1.5 tied to task IDs, Front-End Loop (packages/frontend-loop), Observability Seed (audit_log table), Verification Loop (packages/verification), Workflow Engine v1 (build to verify pipeline), Checkpoint and Rollback on Failure (+6 more)

### Community 15 - "Audit: WFACT 2.0 to 3.0 (KEEP/REPLACE classification)"
Cohesion: 0.24
Nodes (14): Template-First Doctrine, Audit: WFACT 2.0 to 3.0 (KEEP/REPLACE classification), 50-Point Security Audit, WFACT 3.0 Progress Report (for Nick), RLS Isolation Attack Test, WFACT SOP 1 — Sales & Onboarding (md), Amir (2.0 AI chief of staff), Entity Law (DreamSign, Bennett & Co, Rizm/bridge) (+6 more)

### Community 16 - "tools/registry.ts"
Cohesion: 0.18
Nodes (11): main(), ProjectStatusRow, StateReader, stateReaderFromEnv(), SupabaseStateReader, buildToolRegistry(), createProjectStatusTool(), projectStatusInput (+3 more)

### Community 17 - "0008_model_traces.sql"
Cohesion: 0.47
Nodes (5): model_traces_no_truncate, model_traces_no_update, public.model_traces, public.model_usage_by_actor, private.audit_log_refuse_mutation

### Community 18 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 20 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 21 - "WFACT SOP 2 — Production Pipeline (md)"
Cohesion: 0.31
Nodes (11): The Eyes (scroll-record, frame review, jank test <50ms), WFACT SOP 2 — Production Pipeline (md), Concept Pitch (2-3 named concepts), Stage 5 Direction Lock, 11-Stage Client Pipeline (Stages 0-10), Experience Mode (standard-cinematic, scroll-film-A/B), Gate Principle (honest pass/fail per stage), Hosting Law (Hostinger live, Vercel previews only) (+3 more)

### Community 22 - "ToolRegistry"
Cohesion: 0.11
Nodes (16): readClientInput, readClientMemoryTool, readClientOutput, readContextInput, readContextOutput, readContextTool, safeJson(), ToolDefinition (+8 more)

### Community 23 - "0001_init_schema.sql"
Cohesion: 0.44
Nodes (8): public.clients, public.correction_rounds, public.entities, public.profile_clients, public.profiles, public.projects, public.tasks, auth.users

### Community 24 - "WFACT 3.0 Build Playbook"
Cohesion: 0.25
Nodes (9): WFACT 3.0 Build Playbook, Claude Code vs Codex Bake-off, 78-Check Feature Registry, Status Tags (CARRIED OVER, DECIDED, RECOMMENDED, TO TEST, OPEN), Plain-English Tone Filter, Vercel Hobby Serverless Function Ceiling (12/12), WFact Factory Audit (PDF), WFACT 2.0 Factory Book (PDF) (+1 more)

### Community 25 - "0002_entity_consistency_triggers.sql"
Cohesion: 0.22
Nodes (8): public.enforce_project_entity_matches_client(), public.enforce_task_entity_matches_project(), public.clients, public.projects, trg_project_entity_consistency, trg_task_entity_consistency, public.enforce_project_entity_matches_client, public.enforce_task_entity_matches_project

### Community 26 - "0003_rls_policies.sql"
Cohesion: 0.40
Nodes (5): public.assigned_client_ids(), public.current_role_name(), public.is_owner_or_admin(), public.profile_clients, public.profiles

### Community 27 - "0004_security_advisor_fixes.sql"
Cohesion: 0.40
Nodes (5): public.assigned_client_ids(), public.current_role_name(), public.is_owner_or_admin(), public.profile_clients, public.profiles

### Community 28 - "0005_fix_rls_recursion.sql"
Cohesion: 0.40
Nodes (5): private.assigned_client_ids(), private.current_role_name(), private.is_owner_or_admin(), public.profile_clients, public.profiles

### Community 29 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 49 - "audit/src/index.ts"
Cohesion: 0.08
Nodes (27): AuditContext, AuditEvent, AuditOutcome, AuditReader, auditReaderFromEnv(), AuditRecord, AuditSink, auditSinkFromEnv() (+19 more)

### Community 50 - "audit/package.json"
Cohesion: 0.11
Nodes (17): description, devDependencies, tsx, @types/node, typescript, exports, tsx, @types/node (+9 more)

### Community 51 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 52 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 53 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 54 - "0006_audit_log.sql"
Cohesion: 0.40
Nodes (4): audit_log_no_truncate, audit_log_no_update, public.audit_log, private.audit_log_refuse_mutation

### Community 55 - "vercel.json"
Cohesion: 0.40
Nodes (4): main, git, deploymentEnabled, $schema

### Community 56 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 57 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 58 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 62 - "agent-runtime/src/index.ts"
Cohesion: 0.10
Nodes (16): Agent, AgentInputError, AgentRun, AgentRunContext, AgentRunStatus, AgentTask, AgentDefinition, AgentNotRegisteredError (+8 more)

### Community 63 - "agent-runtime/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @wfact/audit, @wfact/hermes-lite, description, devDependencies, tsx, @types/node, typescript (+14 more)

### Community 64 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 65 - "buildAndVerify.ts"
Cohesion: 0.09
Nodes (27): ArtifactStore, assertSafeRelPath(), buildAndVerify(), CheckpointIntegrityError, CheckpointState, FileArtifactStore, MemoryArtifactStore, QaFailure (+19 more)

### Community 66 - "workflow/package.json"
Cohesion: 0.06
Nodes (30): dependencies, @wfact/agent-runtime, @wfact/audit, @wfact/frontend-loop, @wfact/hermes-lite, @wfact/planning, @wfact/verification, description (+22 more)

### Community 67 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 68 - "@wfact/workflow — build → verify (Continuation Plan Stage 3)"
Cohesion: 0.40
Nodes (4): Evidence, Stand-in disclosure (Continuation Plan rule 2), @wfact/workflow — build → verify (Continuation Plan Stage 3), What it does (Blueprint Phase 6, Fig. 02)

### Community 69 - "planner.ts"
Cohesion: 0.05
Nodes (52): blocked(), main(), createIntakeAgent(), entityAmbiguity(), INTAKE_DEFINITION, INTAKE_ROLE, IntakeResult, IntakeResultSchema (+44 more)

### Community 70 - "planning/package.json"
Cohesion: 0.06
Nodes (30): dependencies, @anthropic-ai/sdk, @wfact/agent-runtime, @wfact/audit, @wfact/frontend-loop, @wfact/hermes-lite, zod, description (+22 more)

### Community 71 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 72 - "routing.ts"
Cohesion: 0.26
Nodes (9): DEFAULT_CONFIG_PATH, estimateCostUsd(), loadRoutingTable(), ModelCost, ModelRoute, Provider, resolveModelRoute(), RoutingError (+1 more)

### Community 73 - "0007_plan_approvals.sql"
Cohesion: 0.25
Nodes (6): plan_approvals_decision_guard, plan_approvals_no_delete, public.plan_approvals, auth.users, private.plan_approval_decision_guard, private.plan_approvals_no_delete

## Ambiguous Edges - Review These
- `Documentation Index` → `WFACT 3.0 Complete Ecosystem Blueprint`  [AMBIGUOUS]
  docs/INDEX.md · relation: conceptually_related_to
- `WFACT SOP (PDF)` → `WFact SOP 1 — Sales & Onboarding (PDF)`  [AMBIGUOUS]
  docs/WFACT SOPS/WFACT SOP.pdf · relation: conceptually_related_to

## Knowledge Gaps
- **433 isolated node(s):** `notification-token-display.sh script`, `post-write-token-diff.sh script`, `pre-tool-bash-guard.sh script`, `pre-tool-read-guard.sh script`, `pre-tool-token-guard.sh script` (+428 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 581 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Documentation Index` and `WFACT 3.0 Complete Ecosystem Blueprint`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `WFACT SOP (PDF)` and `WFact SOP 1 — Sales & Onboarding (PDF)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `WFACT 3.0 Continuation Build Plan` connect `WFACT 3.0 Continuation Build Plan` to `WFACT 3.0 Law File (CLAUDE.md)`, `WFACT 3.0 Execution Roadmap`, `WFACT 3.0 Complete Ecosystem Blueprint`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `WFACT 3.0 Complete Ecosystem Blueprint` connect `WFACT 3.0 Complete Ecosystem Blueprint` to `WFACT 3.0 Execution Roadmap`, `WFACT 3.0 Fast-Track Plan`, `WFACT 3.0 Continuation Build Plan`, `Audit: WFACT 2.0 to 3.0 (KEEP/REPLACE classification)`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `Sprint Progress tracker` connect `WFACT 3.0 Law File (CLAUDE.md)` to `WFACT 3.0 Continuation Build Plan`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `notification-token-display.sh script`, `post-write-token-diff.sh script`, `pre-tool-bash-guard.sh script` to the rest of the system?**
  _433 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verificationLoop.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.060939060939060936 - nodes in this community are weakly interconnected._