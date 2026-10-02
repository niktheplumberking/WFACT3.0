# Graph Report - wfact-3.0-build  (2026-10-01)

## Corpus Check
- 232 files · ~313,360 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2265 nodes · 3403 edges · 228 communities (195 shown, 27 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 128 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `644ab2eb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/loop.ts
- WFACT 3.0 Complete Ecosystem Blueprint
- buildAndVerify.ts
- make-fixtures.ts
- audit/src/index.ts
- render.design-review check (cross-vendor screenshot reviewer)
- handlers.test.ts
- agent-runtime/src/index.ts
- jobs/package.json
- workflow/package.json
- hermes/package.json
- planning/package.json
- reviewer.ts
- ToolRegistry
- cockpit/package.json
- verification/package.json
- frontend-loop/package.json
- rendered.ts
- direction.ts
- agent-runtime/package.json
- hermes/src/cli.ts
- verification/src/registry.ts
- verification/src/agent.ts
- claims.ts
- tools/registry.ts
- rendered-qa/package.json
- controller.ts
- verificationLoop.ts
- compilerOptions
- audit/package.json
- supabaseClient.ts
- Actions.tsx
- claims.test.ts
- App.tsx
- pipeline.ts
- intake.ts
- Approvals.tsx
- CLAUDE.md law file
- planning.test.ts
- planner.ts
- PlanApprovals.tsx
- graphify skill (SKILL.md)
- compilerOptions
- compilerOptions
- compilerOptions
- routing.ts
- compilerOptions
- compilerOptions
- planning/src/cli.ts
- compilerOptions
- rendered-qa/src/index.ts
- compilerOptions
- compilerOptions
- compilerOptions
- BLOCKED-ON-NICK tracker
- Archive README
- WFACT 3.0 Continuation Build Plan
- Cockpit Jobs (COCKPIT-JOBS.md)
- VerificationLoop
- M1 rendered QA (headless Chromium, axe, Lighthouse, rulebook detectors)
- 0010_account_requests.sql
- Lessons Ledger
- WFACT Business Context (memory/context.md)
- planStore.ts
- PlanStore
- createRenderedQa
- WFACT 3.0 Factory Completion Plan
- Front-end Upgrade Design (Step 4B)
- 0001_init_schema.sql
- 0002_entity_consistency_triggers.sql
- 0007_plan_approvals.sql
- pg_temp.attack
- Verification loop (Phase 5 check registry + evaluator)
- M2 direction agent + track choice
- rendered.test.ts
- dependencies
- Cockpit job workflow (cockpit-job.yml)
- Models.tsx
- apps/cockpit/index.html
- 0003_rls_policies.sql
- 0004_security_advisor_fixes.sql
- 0005_fix_rls_recursion.sql
- 0006_audit_log.sql
- 0008_model_traces.sql
- vercel.json
- apps/cockpit/package.json
- apps/cockpit/src/App.tsx
- apps/cockpit/src/Approvals.tsx
- apps/cockpit/src/Login.tsx
- manifest.json
- apps/cockpit/src/Pipeline.tsx
- apps/cockpit/src/Runs.tsx
- apps/cockpit/src/stages.ts
- apps/cockpit/src/supabaseClient.ts
- apps/cockpit/tsconfig.json
- apps/cockpit/vite.config.ts
- BLOCKED-ON-NICK.md
- .claude/ARCHITECTURE_MAP.md
- .claude/CLAUDE.md
- .claude/COMMON_MISTAKES.md
- .claude/hooks/notification-token-display.sh
- .claude/hooks/post-write-token-diff.sh
- .claude/hooks/pre-tool-bash-guard.sh
- .claude/hooks/pre-tool-read-guard.sh
- .claude/hooks/pre-tool-token-guard.sh
- .claude/hooks/session-end-token-report.sh
- .claude/hooks/stop-path-guard.sh
- .claude/hooks/stop-session-snapshot.sh
- .claude/hooks/user-prompt-ghost-scanner.sh
- .claude/hooks/user-prompt-inject-context.sh
- .claude/hooks/user-prompt-inject-snapshot.sh
- .claude/hooks/user-prompt-validate-claude-md.sh
- .claude/launch.json
- CLAUDE.md
- .claude/QUICK_START.md
- .claude/settings.json
- clients/dreamsign-pilot/brief.json
- clients/dreamsign-pilot/memory.md
- clients/dreamsign-pilot/pages/clean-agency.html
- clients/_template/memory.md
- docs/INDEX.md
- docs/WFACT-3.0-Continuation-Build-Plan.md
- docs/WFACT SOPS/Claude outputs/WFACT-3.0-Fast-Track-Plan.md
- docs/WFACT SOPS/Claude outputs/WFACT-SOP-1-Sales-Onboarding.md
- docs/WFACT SOPS/Claude outputs/WFACT-SOP-2-Production-Pipeline.md
- docs/WFACT SOPS/Claude outputs/WFACT-SOP-3-Post-Launch-Automation-Team-Ops.md
- .github/workflows/ci.yml
- packages/db/migrations/0001_init_schema.sql
- packages/db/migrations/0002_entity_consistency_triggers.sql
- packages/db/migrations/0003_rls_policies.sql
- packages/db/migrations/0004_security_advisor_fixes.sql
- packages/db/migrations/0005_fix_rls_recursion.sql
- packages/frontend-loop/package.json
- packages/frontend-loop/src/brief.ts
- packages/frontend-loop/src/cli.ts
- packages/frontend-loop/src/correctionLog.ts
- packages/frontend-loop/src/loop.ts
- packages/frontend-loop/src/modelClient.ts
- packages/frontend-loop/src/paths.ts
- packages/frontend-loop/src/templates.ts
- packages/frontend-loop/test/brief.test.ts
- packages/frontend-loop/test/correctionLog.test.ts
- packages/frontend-loop/test/loop.test.ts
- packages/frontend-loop/test/templates.test.ts
- packages/frontend-loop/tsconfig.json
- packages/hermes/package.json
- packages/hermes/scripts/verify-supabase-connection.ts
- packages/hermes/src/cli.ts
- packages/hermes/src/controller.ts
- packages/hermes/src/escalation.ts
- packages/hermes/src/modelClient.ts
- packages/hermes/src/state.ts
- packages/hermes/src/toneFilter.ts
- packages/hermes/src/tools/memoryTools.ts
- packages/hermes/src/tools/registry.ts
- packages/hermes/src/tools/schema.ts
- packages/hermes/src/tools/stateTools.ts
- packages/hermes/test/controller.test.ts
- packages/hermes/test/escalation.test.ts
- packages/hermes/test/memoryTools.test.ts
- packages/hermes/test/schema.test.ts
- packages/hermes/test/toneFilter.test.ts
- packages/hermes/tsconfig.json
- packages/verification/package.json
- packages/verification/src/checks/imageOptimization.ts
- packages/verification/src/checks/isolation.ts
- packages/verification/src/checks/noConsoleErrors.ts
- packages/verification/src/checks/requiredSections.ts
- packages/verification/src/checks/responsive.ts
- packages/verification/src/checks/secretsScan.ts
- packages/verification/src/checks/types.ts
- packages/verification/src/cli.ts
- packages/verification/src/evaluator.ts
- packages/verification/src/modelClient.ts
- packages/verification/src/paths.ts
- packages/verification/src/registry.ts
- packages/verification/src/verificationLoop.ts
- packages/verification/test/evaluator.test.ts
- packages/verification/test/registry.test.ts
- packages/verification/test/verificationLoop.test.ts
- packages/verification/tsconfig.json
- PROGRESS.md
- README.md
- scripts/rls_attack_test.sql
- 0009_jobs.sql
- content.ts
- Sample Lead: Harbor Street Bakery (synthetic, Bennett & Co)
- pg_temp.attack_tracks
- dispatch-job/index.ts
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
- Per-client memory template
- Hermes-lite (Phase 3 controller stand-in)
- Architecture Map (template)
- graphify skill trigger
- Common Mistakes (template)
- Quick Start Commands (template)
- WFACT Cockpit HTML entry
- Correction-round log (correction-batch metric)
- public.clients
- public.projects
- public.plan_approvals
- public.correction_rounds
- public.entities
- public.tasks
- render.ts
- frontend-loop/src/cli.ts
- PilotBrief
- FrontendLoop
- palette.ts
- brief.ts
- rendered-qa/test/trackA.test.ts

## God Nodes (most connected - your core abstractions)
1. `PilotBrief` - 22 edges
2. `WFACT 3.0 Complete Ecosystem Blueprint` - 21 edges
3. `VerificationContext` - 19 edges
4. `render.design-review check (cross-vendor screenshot reviewer)` - 19 edges
5. `CLAUDE.md law file` - 18 edges
6. `make-fixtures.ts fixture generator` - 18 edges
7. `Summit Line Roofing synthetic clean base` - 17 edges
8. `compilerOptions` - 16 edges
9. `ToolRegistry` - 16 edges
10. `WFACT 3.0 Continuation Build Plan` - 16 edges

## Surprising Connections (you probably didn't know these)
- `WFACT SOP 1 — Sales & Onboarding (md)` --semantically_similar_to--> `WFact SOP 1 — Sales & Onboarding (PDF)`  [INFERRED] [semantically similar]
  docs/WFACT SOPS/Claude outputs/WFACT-SOP-1-Sales-Onboarding.md → docs/WFACT SOPS/WFact SOP 1 — Sales & Onboarding (Lead to Signed).pdf
- `WFACT SOP 2 — Production Pipeline (md)` --semantically_similar_to--> `WFact SOP 2 — Production Pipeline (PDF)`  [INFERRED] [semantically similar]
  docs/WFACT SOPS/Claude outputs/WFACT-SOP-2-Production-Pipeline.md → docs/WFACT SOPS/WFact SOP 2 — Production Pipeline (Stages 1–8).pdf
- `WFACT SOP 3 — Post-Launch, Automation & Team Ops (md)` --semantically_similar_to--> `WFact SOP 3 — Post-Launch, Automation & Team Ops (PDF)`  [INFERRED] [semantically similar]
  docs/WFACT SOPS/Claude outputs/WFACT-SOP-3-Post-Launch-Automation-Team-Ops.md → docs/WFACT SOPS/WFact SOP 3 — Post-Launch, Automation & Team Operations.pdf
- `graphify reference: commit hook and CLAUDE.md integration` --conceptually_related_to--> `CLAUDE.md law file`  [INFERRED]
  .claude/skills/graphify/references/hooks.md → CLAUDE.md
- `Repo law & structure guardrails job (gitleaks, required files, plaintext secret block)` --references--> `CLAUDE.md law file`  [INFERRED]
  .github/workflows/ci.yml → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Build, checkpoint, QA, revise, launch gate loop** — packages_workflow_readme_workflow, packages_workflow_readme_checkpoint, packages_rendered_qa_readme_rendered_qa, packages_workflow_readme_frontendloop_revise, packages_workflow_readme_launch_gate [EXTRACTED 1.00]
- **Cockpit job dispatch flow** — docs_cockpit_jobs_jobs_table, docs_cockpit_jobs_dispatch_job, docs_cockpit_jobs_cockpit_job_workflow, docs_cockpit_jobs_jobs_run [EXTRACTED 1.00]
- **Design rule verification: builder prompt, DOM detectors, screenshot review** — packages_frontend_loop_design_readme_design_rulebook, packages_frontend_loop_design_readme_frontendloop_buildsystemprompt, packages_frontend_loop_design_readme_render_design_rules, packages_frontend_loop_design_readme_render_design_review, packages_frontend_loop_design_readme_render_layout [EXTRACTED 1.00]
- **Rules judged only by the screenshot reviewer** — packages_frontend_loop_design_readme_dr_repeated_rhythm, packages_frontend_loop_design_readme_dq_art_direction, packages_frontend_loop_design_readme_dq_content_hierarchy, packages_frontend_loop_design_readme_dq_type_hierarchy, packages_frontend_loop_design_readme_render_design_review [EXTRACTED 1.00]
- **RLS recursion bug and fix** — packages_db_rls_attack_test_results_is_owner_or_admin, packages_db_rls_attack_test_results_migration_0005, memory_lessons_ledger_rls_recursion_lesson [EXTRACTED 1.00]
- **Step 4B two-track front-end pipeline** — docs_frontend_upgrade_design_direction_step, docs_frontend_upgrade_design_track_a, docs_frontend_upgrade_design_track_b, docs_frontend_upgrade_design_rendered_qa, docs_frontend_upgrade_design_claims_gate, docs_frontend_upgrade_design_design_rulebook [EXTRACTED 1.00]
- **WFACT repo entry documents (read-first set)** — readme, claude, progress, blocked_on_nick [EXTRACTED 1.00]
- **Cockpit job dispatch flow** — claude_cockpit, _github_workflows_cockpit_job_dispatch_job_edge_function, _github_workflows_cockpit_job, progress_cockpit_jobs, doppler_secrets_manager [INFERRED 0.85]
- **Human-gated money and launch control** — docs_wfact_3_0_ecosystem_blueprint_three_approval_tiers, docs_wfact_sops_claude_outputs_wfact_sop_3_post_launch_automation_team_ops_autonomy_switchboard, docs_wfact_sops_claude_outputs_wfact_sop_2_production_pipeline_gate_principle, docs_wfact_sops_claude_outputs_wfact_sop_1_sales_onboarding_three_human_moments_stage0 [INFERRED 0.85]
- **Step 4B M1 verification gate (claims, rendered QA, rulebook, reviewer)** — progress_step_4b_m1_claims_gate, progress_step_4b_m1_rendered_qa, progress_design_rulebook, progress_same_vendor_reviewer_deviation, _github_workflows_ci_rendered_qa_job [INFERRED 0.85]
- **WFACT memory stack feeding Hermes** — docs_wfact_3_0_playbook_flat_file_memory, docs_wfact_3_0_playbook_tone_filter, docs_wfact_3_0_ecosystem_blueprint_hermes_controller, docs_wfact_3_0_ecosystem_blueprint_second_brain, docs_wfact_sops_claude_outputs_wfact_sop_3_post_launch_automation_team_ops_post_mortem_lessons_ledger [INFERRED 0.85]
- **Claims gate planted-failure fixtures** — packages_verification_test_fixtures_claims_banned_claim_banned_claim, packages_verification_test_fixtures_claims_invented_fact_invented_fact, packages_verification_test_fixtures_claims_leaked_text_leaked_text, packages_verification_test_fixtures_claims_missing_sample_missing_sample, packages_rendered_qa_readme_claims_gate [INFERRED 0.95]
- **Rendered suite planted-failure fixtures** — packages_rendered_qa_test_fixtures_broken_link_broken_link, packages_rendered_qa_test_fixtures_console_error_console_error, packages_rendered_qa_test_fixtures_over_budget_js_over_budget_js, packages_rendered_qa_test_fixtures_reduced_motion_ignored_reduced_motion_ignored, packages_rendered_qa_readme_rendered_suite [INFERRED 0.95]

## Communities (228 total, 27 thin omitted)

### Community 0 - "src/loop.ts"
Cohesion: 0.12
Nodes (18): FRONT_END_BUILDER_ROLE, FrontendBuilderAgentOptions, FrontendBuildInput, FrontendLoopOptions, parseReviewResponse(), ReviewResult, SiteBuild, MockModelClient (+10 more)

### Community 1 - "WFACT 3.0 Complete Ecosystem Blueprint"
Cohesion: 0.05
Nodes (62): WFACT 3.0 Ecosystem Blueprint (HTML), WFACT 3.0 Complete Ecosystem Blueprint, Blueprint Build Order (Phases 0-12), Checkpoint and Rollback on Failure, Cockpit / Control Room 3.0, Cognee (second brain candidate), Definition of Done (§16K), Durable Execution Engine (n8n / Temporal) (+54 more)

### Community 2 - "buildAndVerify.ts"
Cohesion: 0.06
Nodes (45): ARTIFACT_PATH_RE, ArtifactStore, assertSafeRelPath(), buildAndVerify(), CheckpointIntegrityError, CheckpointState, FileArtifactStore, isSiteManifest() (+37 more)

### Community 3 - "make-fixtures.ts"
Cohesion: 0.06
Nodes (46): Direction Agent (claude-sonnet-5), Direction Step Evaluation (Step 4B M2), Intake Agent (claude-haiku-4-5), Niche Taxonomy v1.0.0, Case: summit-line-roofing (Track A, local-trade), Build Track Recommendation (A / B / none), Claims Gate (after-html, sample-label, banned, unsourced-fact), NOT RUN status (never approved) (+38 more)

### Community 4 - "audit/src/index.ts"
Cohesion: 0.08
Nodes (27): AuditContext, AuditEvent, AuditOutcome, AuditReader, auditReaderFromEnv(), AuditRecord, AuditSink, auditSinkFromEnv() (+19 more)

### Community 5 - "render.design-review check (cross-vendor screenshot reviewer)"
Cohesion: 0.11
Nodes (46): clean.html fixture (passes every deterministic check), DQ-ART-DIRECTION fixture (ignores brand direction (generic grey, no pine/cream/copper)), DQ-CONTENT-HIERARCHY fixture (hero says nothing about the business, three competing actions), DQ-MOBILE-READABLE fixture (tiny text and tap targets on phones), DQ-TYPE-HIERARCHY fixture (flat type scale, headline same size as body), DR-CENTRED-EVERYTHING fixture (centred-everything layout), DR-EMOJI-ICONS fixture (emoji used as icons), DR-EYEBROW-OVERUSE fixture (uppercase eyebrow above every heading) (+38 more)

### Community 6 - "handlers.test.ts"
Cohesion: 0.08
Nodes (23): handleJob(), HandlerDeps, JobOutcome, planningOutcome(), uuid(), workflowOutcome(), Job, JobKind (+15 more)

### Community 7 - "agent-runtime/src/index.ts"
Cohesion: 0.10
Nodes (16): Agent, AgentInputError, AgentRun, AgentRunContext, AgentRunStatus, AgentTask, AgentDefinition, AgentNotRegisteredError (+8 more)

### Community 8 - "jobs/package.json"
Cohesion: 0.06
Nodes (33): dependencies, @wfact/agent-runtime, @wfact/audit, @wfact/frontend-loop, @wfact/hermes-lite, @wfact/planning, @wfact/rendered-qa, @wfact/verification (+25 more)

### Community 9 - "workflow/package.json"
Cohesion: 0.06
Nodes (32): dependencies, @wfact/agent-runtime, @wfact/audit, @wfact/frontend-loop, @wfact/hermes-lite, @wfact/planning, @wfact/rendered-qa, @wfact/verification (+24 more)

### Community 10 - "hermes/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @anthropic-ai/sdk, @supabase/supabase-js, @wfact/audit, zod, description, devDependencies, tsx (+23 more)

### Community 11 - "planning/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @anthropic-ai/sdk, @wfact/agent-runtime, @wfact/audit, @wfact/frontend-loop, @wfact/hermes-lite, zod, description (+23 more)

### Community 12 - "reviewer.ts"
Cohesion: 0.09
Nodes (25): Shot, createScreenshotReviewSuite(), DEFAULT_MODELS, DEFAULT_REVIEWER_MODEL, loadReviewerDecision(), parseReview(), REVIEW_CHECK_ID, ReviewCall (+17 more)

### Community 13 - "ToolRegistry"
Cohesion: 0.11
Nodes (16): readClientInput, readClientMemoryTool, readClientOutput, readContextInput, readContextOutput, readContextTool, safeJson(), ToolDefinition (+8 more)

### Community 14 - "cockpit/package.json"
Cohesion: 0.07
Nodes (27): dependencies, react, react-dom, @supabase/supabase-js, description, devDependencies, @types/react, @types/react-dom (+19 more)

### Community 15 - "verification/package.json"
Cohesion: 0.07
Nodes (28): dependencies, @anthropic-ai/sdk, node-html-parser, @wfact/agent-runtime, @wfact/audit, @wfact/hermes-lite, description, devDependencies (+20 more)

### Community 16 - "frontend-loop/package.json"
Cohesion: 0.07
Nodes (28): dependencies, @anthropic-ai/sdk, @wfact/agent-runtime, @wfact/audit, @wfact/hermes-lite, zod, description, devDependencies (+20 more)

### Community 17 - "rendered.ts"
Cohesion: 0.11
Nodes (21): DESIGN_DETECTORS, HELPERS, INLINE_JS_BYTES, LAYOUT_PROBE, LINK_PROBE, MOTION_PROBE, SCROLL_THROUGH, AXE_TAGS (+13 more)

### Community 18 - "direction.ts"
Cohesion: 0.10
Nodes (20): applyDirectionRules(), ASPECTS, CONFLICT_CONFIDENCE, DirectionInput, DirectionResultSchema, GOALS, MODEL_DIRECTION_JSON_SCHEMA, ModelDirection (+12 more)

### Community 19 - "agent-runtime/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @wfact/audit, @wfact/hermes-lite, description, devDependencies, tsx, @types/node, typescript (+14 more)

### Community 20 - "hermes/src/cli.ts"
Cohesion: 0.14
Nodes (13): main(), HermesLite, HermesLiteOptions, ClaudeModelClient, MockModelClient, ModelClient, modelClientFromEnv(), ModelNotConfiguredError (+5 more)

### Community 21 - "verification/src/registry.ts"
Cohesion: 0.23
Nodes (14): imageOptimizationCheck, isolationCheck, noConsoleErrorsCheck, escapeRegExp(), requiredSectionsCheck, sectionPresent(), visibleText(), responsiveCheck (+6 more)

### Community 22 - "verification/src/agent.ts"
Cohesion: 0.15
Nodes (14): createQaEvaluatorAgent(), parseSite(), QA_EVALUATOR_ROLE, QaInput, stringArray(), main(), ClaudeModelClient, evaluatorModelClientFromEnv() (+6 more)

### Community 23 - "claims.ts"
Cohesion: 0.12
Nodes (16): bannedClaimsCheck, BLOCK_STOP, CLAIMS_RULES, ClaimsRules, contentAfterHtmlCheck, deepestContaining(), INLINE, isElement() (+8 more)

### Community 24 - "tools/registry.ts"
Cohesion: 0.18
Nodes (11): main(), ProjectStatusRow, StateReader, stateReaderFromEnv(), SupabaseStateReader, buildToolRegistry(), createProjectStatusTool(), projectStatusInput (+3 more)

### Community 25 - "rendered-qa/package.json"
Cohesion: 0.08
Nodes (24): description, devDependencies, tsx, @types/node, typescript, exports, tsx, @types/node (+16 more)

### Community 26 - "controller.ts"
Cohesion: 0.18
Nodes (12): detectEntitySlug(), HermesAnswer, KNOWN_ENTITIES, EscalationError, RetryOptions, withBoundedRetry(), applyToneFilter(), buildPlainLanguageSystemPrompt() (+4 more)

### Community 27 - "verificationLoop.ts"
Cohesion: 0.21
Nodes (11): QaEvaluatorAgentOptions, AsyncCheckSuite, EvaluatorVerdict, parseEvaluatorResponse(), RUBRIC, runEvaluator(), siteForReview(), ModelClient (+3 more)

### Community 28 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 29 - "audit/package.json"
Cohesion: 0.11
Nodes (17): description, devDependencies, tsx, @types/node, typescript, exports, tsx, @types/node (+9 more)

### Community 30 - "supabaseClient.ts"
Cohesion: 0.20
Nodes (11): Status, MIN_PASSWORD_LENGTH, Mode, Pipeline(), ProjectRow, RoundRow, Runs(), anonKey (+3 more)

### Community 31 - "Actions.tsx"
Cohesion: 0.22
Nodes (14): Actions(), go(), start(), isStaleQueued(), KIND_LABEL, PagePreview(), load(), PlanLite (+6 more)

### Community 32 - "claims.test.ts"
Cohesion: 0.14
Nodes (12): CLAIMS_CHECKS, CHECK_REGISTRY, CLAIMS_CHECKS, QA_GATE_CHECKS, runChecks(), brief, cleanCtx(), ctx() (+4 more)

### Community 33 - "App.tsx"
Cohesion: 0.15
Nodes (9): AccessPending(), App(), Room, ROOMS, Stats, useHasProfile(), useStats(), Login() (+1 more)

### Community 34 - "pipeline.ts"
Cohesion: 0.19
Nodes (14): createDirectionAgent(), DIRECTION_DEFINITION, DIRECTION_ROLE, DIRECTION_TAXONOMY, Case, dir, main(), { version, cases } (+6 more)

### Community 35 - "intake.ts"
Cohesion: 0.14
Nodes (10): entityAmbiguity(), IntakeResultSchema, LEAD_TYPES, MODEL_INTAKE_JSON_SCHEMA, ModelIntakeSchema, RawRequest, slugify(), JsonModelClient (+2 more)

### Community 36 - "Approvals.tsx"
Cohesion: 0.19
Nodes (12): AccessRequests(), decide(), load(), RequestRow, Role, Approvals(), approve(), load() (+4 more)

### Community 37 - "CLAUDE.md law file"
Cohesion: 0.16
Nodes (15): Hermes-lite fallback disclosure, Hostinger descoped; Vercel substitutes for proof run, CLAUDE.md law file, Entity law (one client per entity, N-capable), Factory Completion Plan (Steps 1-24), The Five Pillars (Memory, Factory, Models, UI/UX, Build workflow), Governance split (Nick, Huraira, Atif, Toby), Hermes controller (decides, never executes) (+7 more)

### Community 38 - "planning.test.ts"
Cohesion: 0.18
Nodes (9): MockJsonClient, ModelPlan, PLANNER_ROLE, MemoryPlanStore, deps(), certainIntake, deps(), modelIntake() (+1 more)

### Community 39 - "planner.ts"
Cohesion: 0.14
Nodes (11): assemblePlan(), createPlannerAgent(), EXECUTABLE_STAGES, MODEL_PLAN_JSON_SCHEMA, ModelPlanSchema, PLAN_VERSION, PLANNER_DEFINITION, PlannerInput (+3 more)

### Community 40 - "PlanApprovals.tsx"
Cohesion: 0.15
Nodes (11): Direction, GOAL_LABEL, PlanApprovals(), decide(), load(), PlanBody, PlanRow, PlanTask (+3 more)

### Community 41 - "graphify skill (SKILL.md)"
Cohesion: 0.17
Nodes (13): graphify reference: add URL and watch folder, graphify reference: extra exports and benchmark, graphify reference: extraction subagent prompt, graphify reference: GitHub clone and cross-repo merge, graphify reference: commit hook and CLAUDE.md integration, graphify reference: query, path, explain, graphify reference: transcribe video and audio, graphify reference: incremental update and cluster-only (+5 more)

### Community 42 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 43 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 44 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 45 - "routing.ts"
Cohesion: 0.26
Nodes (9): DEFAULT_CONFIG_PATH, estimateCostUsd(), loadRoutingTable(), ModelCost, ModelRoute, Provider, resolveModelRoute(), RoutingError (+1 more)

### Community 46 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 47 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 48 - "planning/src/cli.ts"
Cohesion: 0.26
Nodes (8): blocked(), main(), ClaudeJsonClient, ModelOutputError, intakeAndPlan(), planFrom(), replan(), planStoreFromEnv()

### Community 49 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 50 - "rendered-qa/src/index.ts"
Cohesion: 0.27
Nodes (10): RenderedQa, RenderedQaSetup, ReviewerSetup, RenderedQaOptions, RenderedSuite, TRACK_A_BUDGET, VIEWPORTS, ReviewerDecision (+2 more)

### Community 51 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 52 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 53 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noUncheckedIndexedAccess, outDir, resolveJsonModule, skipLibCheck (+3 more)

### Community 54 - "BLOCKED-ON-NICK tracker"
Cohesion: 0.29
Nodes (11): BLOCKED-ON-NICK tracker, Agent 37 (self-hosted Hermes Agent gateway), $5 per-build spend ceiling, Comp and scope, closed in writing, One real pilot project brief (from Nick), dreamsign-pilot client memory, clean-agency template, DreamSign clean-agency homepage (built page) (+3 more)

### Community 55 - "Archive README"
Cohesion: 0.20
Nodes (11): Graph Report snapshot 2026-09-28, WFACT 3.0 Nick Progress Update (archived), WFACT 3.0 Nick Requirements (archived), Archive README, Fast-Track Plan (old copy), WFACT 3.0 Fast-Track Plan, Non-skippable quality gates, WFACT 3.0 100-Hour Build Plan (Nick) (+3 more)

### Community 56 - "WFACT 3.0 Continuation Build Plan"
Cohesion: 0.20
Nodes (11): WFACT 3.0 Build Operator's Manual, 100-hour sprint 7 phases, WFACT 3.0 Continuation Build Plan, Dependency-gated stages, Stage 1: Close Phase 0/1 debt, Stage 2: Generalize the agent runtime, Stage 3: Workflow engine v1 (build to verify pipeline), Stage 5: Observability seed (+3 more)

### Community 57 - "Cockpit Jobs (COCKPIT-JOBS.md)"
Cohesion: 0.25
Nodes (11): Cockpit Jobs (COCKPIT-JOBS.md), cockpit-job.yml GitHub workflow, dispatch-job Edge Function, GITHUB_DISPATCH_TOKEN secret, Job kinds (intake, replan, build_plan, resume, verify, ask), packages/jobs run.ts runner, public.jobs table, jobs_validate_request trigger (+3 more)

### Community 58 - "VerificationLoop"
Cohesion: 0.15
Nodes (6): MockModelClient, VerificationLoop, FIXTURES_DIR, brokenCtx, cleanCtx, FIXTURES_DIR

### Community 59 - "M1 rendered QA (headless Chromium, axe, Lighthouse, rulebook detectors)"
Cohesion: 0.24
Nodes (10): Completion: Step 4B M1 rendered QA + claims gate, Builder model decision (Agent 37 vs second provider), OpenAI credits for Step 4B screenshot reviewer (worked around), Evaluator never same instance/vendor as builder, Correction-round log (vs DreamSign 2.0 40+ baseline), Design rulebook v1.0.0 (frontend-loop/design/rulebook.json), Same-vendor screenshot reviewer deviation (reviewer.json), Step 4B: front-end upgrade, two build tracks (+2 more)

### Community 60 - "0010_account_requests.sql"
Cohesion: 0.22
Nodes (8): auth, on_auth_user_created_request, private.is_owner(), public.account_requests, public.decide_account_request(), auth.users, public.profiles, private.handle_new_auth_user

### Community 61 - "Lessons Ledger"
Cohesion: 0.27
Nodes (10): Direction step agent (niche, brand direction, track recommendation), Step 8: Task/event queue and durable execution, Lessons Ledger, Connects is not works: anon key returns zero rows, RLS helper recursion lesson (SECURITY DEFINER in private schema), RLS Attack Test Results, Cross-entity isolation attack test, is_owner_or_admin() helper (+2 more)

### Community 62 - "WFACT Business Context (memory/context.md)"
Cohesion: 0.24
Nodes (10): Step 4B milestones M0-M6, Definition of Done goals (Blueprint 16K), Step 4: Full run on the pilot brief, WFACT Business Context (memory/context.md), Bennett & Co entity, Correction-batch benchmark (DreamSign 40+), DreamSign entity, 11-stage pipeline (Playbook section 7) (+2 more)

### Community 63 - "planStore.ts"
Cohesion: 0.38
Nodes (9): DirectionResult, IntakeResult, PlanningResult, Plan, BuildTrack, InsertPendingArgs, PlanStatus, Row (+1 more)

### Community 64 - "PlanStore"
Cohesion: 0.24
Nodes (4): PlanningDeps, PlanStore, SupabasePlanStore, toStored()

### Community 65 - "createRenderedQa"
Cohesion: 0.36
Nodes (8): arg(), flag(), main(), createRenderedQa(), reviewerFromEnv(), productionQaOptions(), ProductionQaSetup, createRenderedSuite()

### Community 66 - "WFACT 3.0 Factory Completion Plan"
Cohesion: 0.22
Nodes (9): WFACT 3.0 Execution Roadmap, Operating principles (verify, revenue first, one loop), Stage 6: Episodic memory v1.5, WFACT 3.0 Factory Completion Plan, Standard Operating Rules (Part C), Step 4C: Cockpit UI/UX redesign, Step 5: Documentation agent and episodic memory, Step report format and GO gate (+1 more)

### Community 67 - "Front-end Upgrade Design (Step 4B)"
Cohesion: 0.31
Nodes (9): Front-end Upgrade Design (Step 4B), Claims gate (content-as-data, cited facts or SAMPLE labels), Design rulebook (rulebook.json, anti-AI-slop), Rendered QA (screenshots at 1440/768/375, cross-vendor review), Track A: local business, conversion-first, Track B: motion-rich brand site (Next.js), Design quality rule (no AI slop), Step 4B: Front-end upgrade, two build tracks (+1 more)

### Community 68 - "0001_init_schema.sql"
Cohesion: 0.44
Nodes (8): public.clients, public.correction_rounds, public.entities, public.profile_clients, public.profiles, public.projects, public.tasks, auth.users

### Community 69 - "0002_entity_consistency_triggers.sql"
Cohesion: 0.22
Nodes (8): public.enforce_project_entity_matches_client(), public.enforce_task_entity_matches_project(), public.clients, public.projects, trg_project_entity_consistency, trg_task_entity_consistency, public.enforce_project_entity_matches_client, public.enforce_task_entity_matches_project

### Community 70 - "0007_plan_approvals.sql"
Cohesion: 0.25
Nodes (6): plan_approvals_decision_guard, plan_approvals_no_delete, public.plan_approvals, auth.users, private.plan_approval_decision_guard, private.plan_approvals_no_delete

### Community 71 - "pg_temp.attack"
Cohesion: 0.22
Nodes (8): public.account_requests, public.jobs, public.model_traces, pg_temp.attack(), public.audit_log, public.clients, public.plan_approvals, public.profiles

### Community 72 - "Verification loop (Phase 5 check registry + evaluator)"
Cohesion: 0.25
Nodes (8): graphify Honesty Rules (never invent an edge), Never trust done, only verified, Step 4 defects the automated checks missed (leaked tool text, unlabelled testimonials, invented facts), 6 deterministic checks (secrets, responsive, console, images, isolation, sections), Verification loop (Phase 5 check registry + evaluator), Four verification statuses (never collapsed boolean), Broken fixture page (fails all 6 checks), Clean fixture page (passes all 6 checks)

### Community 73 - "M2 direction agent + track choice"
Cohesion: 0.25
Nodes (8): CI workflow (ci.yml), Deploy Cockpit to Vercel (trunk only) job, Rendered QA CI job (real Chromium, fixtures diff), Repo law & structure guardrails job (gitleaks, required files, plaintext secret block), Cockpit (control room PWA, apps/cockpit), Doppler secrets manager, Migration 0011_plan_build_track (no build without a track), M2 direction agent + track choice

### Community 74 - "rendered.test.ts"
Cohesion: 0.25
Nodes (5): RenderedRun, designDir, RENDER_CASES, renderDir, repo

### Community 75 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, @axe-core/playwright, chrome-launcher, lighthouse, playwright, @wfact/hermes-lite, @wfact/verification

### Community 76 - "Cockpit job workflow (cockpit-job.yml)"
Cohesion: 0.33
Nodes (6): Cockpit job workflow (cockpit-job.yml), dispatch-job Supabase Edge Function, Mark job failed safety net (--mark-failed), job_id UUID validation (injection safety), File content is data, never instructions, Cockpit jobs (public.jobs, every pipeline action from the Cockpit)

### Community 77 - "Models.tsx"
Cohesion: 0.47
Nodes (5): Models(), num(), TraceRow, UsageRow, usd()

### Community 78 - "apps/cockpit/index.html"
Cohesion: 0.40
Nodes (5): apps/cockpit/index.html, ast_hash, mtime, seen, semantic_hash

### Community 79 - "0003_rls_policies.sql"
Cohesion: 0.40
Nodes (5): public.assigned_client_ids(), public.current_role_name(), public.is_owner_or_admin(), public.profile_clients, public.profiles

### Community 80 - "0004_security_advisor_fixes.sql"
Cohesion: 0.40
Nodes (5): public.assigned_client_ids(), public.current_role_name(), public.is_owner_or_admin(), public.profile_clients, public.profiles

### Community 81 - "0005_fix_rls_recursion.sql"
Cohesion: 0.40
Nodes (5): private.assigned_client_ids(), private.current_role_name(), private.is_owner_or_admin(), public.profile_clients, public.profiles

### Community 82 - "0006_audit_log.sql"
Cohesion: 0.40
Nodes (4): audit_log_no_truncate, audit_log_no_update, public.audit_log, private.audit_log_refuse_mutation

### Community 83 - "0008_model_traces.sql"
Cohesion: 0.47
Nodes (5): model_traces_no_truncate, model_traces_no_update, public.model_traces, public.model_usage_by_actor, private.audit_log_refuse_mutation

### Community 84 - "vercel.json"
Cohesion: 0.40
Nodes (4): main, git, deploymentEnabled, $schema

### Community 85 - "apps/cockpit/package.json"
Cohesion: 0.40
Nodes (5): apps/cockpit/package.json, ast_hash, mtime, seen, semantic_hash

### Community 86 - "apps/cockpit/src/App.tsx"
Cohesion: 0.40
Nodes (5): apps/cockpit/src/App.tsx, ast_hash, mtime, seen, semantic_hash

### Community 87 - "apps/cockpit/src/Approvals.tsx"
Cohesion: 0.40
Nodes (5): apps/cockpit/src/Approvals.tsx, ast_hash, mtime, seen, semantic_hash

### Community 88 - "apps/cockpit/src/Login.tsx"
Cohesion: 0.40
Nodes (5): apps/cockpit/src/Login.tsx, ast_hash, mtime, seen, semantic_hash

### Community 89 - "manifest.json"
Cohesion: 0.33
Nodes (5): apps/cockpit/src/main.tsx, ast_hash, mtime, seen, semantic_hash

### Community 90 - "apps/cockpit/src/Pipeline.tsx"
Cohesion: 0.40
Nodes (5): apps/cockpit/src/Pipeline.tsx, ast_hash, mtime, seen, semantic_hash

### Community 91 - "apps/cockpit/src/Runs.tsx"
Cohesion: 0.40
Nodes (5): apps/cockpit/src/Runs.tsx, ast_hash, mtime, seen, semantic_hash

### Community 92 - "apps/cockpit/src/stages.ts"
Cohesion: 0.40
Nodes (5): apps/cockpit/src/stages.ts, ast_hash, mtime, seen, semantic_hash

### Community 93 - "apps/cockpit/src/supabaseClient.ts"
Cohesion: 0.40
Nodes (5): apps/cockpit/src/supabaseClient.ts, ast_hash, mtime, seen, semantic_hash

### Community 94 - "apps/cockpit/tsconfig.json"
Cohesion: 0.40
Nodes (5): apps/cockpit/tsconfig.json, ast_hash, mtime, seen, semantic_hash

### Community 95 - "apps/cockpit/vite.config.ts"
Cohesion: 0.40
Nodes (5): apps/cockpit/vite.config.ts, ast_hash, mtime, seen, semantic_hash

### Community 96 - "BLOCKED-ON-NICK.md"
Cohesion: 0.40
Nodes (5): BLOCKED-ON-NICK.md, ast_hash, mtime, seen, semantic_hash

### Community 97 - ".claude/ARCHITECTURE_MAP.md"
Cohesion: 0.40
Nodes (5): .claude/ARCHITECTURE_MAP.md, ast_hash, mtime, seen, semantic_hash

### Community 98 - ".claude/CLAUDE.md"
Cohesion: 0.40
Nodes (5): .claude/CLAUDE.md, ast_hash, mtime, seen, semantic_hash

### Community 99 - ".claude/COMMON_MISTAKES.md"
Cohesion: 0.40
Nodes (5): .claude/COMMON_MISTAKES.md, ast_hash, mtime, seen, semantic_hash

### Community 100 - ".claude/hooks/notification-token-display.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/notification-token-display.sh, ast_hash, mtime, seen, semantic_hash

### Community 101 - ".claude/hooks/post-write-token-diff.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/post-write-token-diff.sh, ast_hash, mtime, seen, semantic_hash

### Community 102 - ".claude/hooks/pre-tool-bash-guard.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/pre-tool-bash-guard.sh, ast_hash, mtime, seen, semantic_hash

### Community 103 - ".claude/hooks/pre-tool-read-guard.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/pre-tool-read-guard.sh, ast_hash, mtime, seen, semantic_hash

### Community 104 - ".claude/hooks/pre-tool-token-guard.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/pre-tool-token-guard.sh, ast_hash, mtime, seen, semantic_hash

### Community 105 - ".claude/hooks/session-end-token-report.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/session-end-token-report.sh, ast_hash, mtime, seen, semantic_hash

### Community 106 - ".claude/hooks/stop-path-guard.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/stop-path-guard.sh, ast_hash, mtime, seen, semantic_hash

### Community 107 - ".claude/hooks/stop-session-snapshot.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/stop-session-snapshot.sh, ast_hash, mtime, seen, semantic_hash

### Community 108 - ".claude/hooks/user-prompt-ghost-scanner.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/user-prompt-ghost-scanner.sh, ast_hash, mtime, seen, semantic_hash

### Community 109 - ".claude/hooks/user-prompt-inject-context.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/user-prompt-inject-context.sh, ast_hash, mtime, seen, semantic_hash

### Community 110 - ".claude/hooks/user-prompt-inject-snapshot.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/user-prompt-inject-snapshot.sh, ast_hash, mtime, seen, semantic_hash

### Community 111 - ".claude/hooks/user-prompt-validate-claude-md.sh"
Cohesion: 0.40
Nodes (5): .claude/hooks/user-prompt-validate-claude-md.sh, ast_hash, mtime, seen, semantic_hash

### Community 112 - ".claude/launch.json"
Cohesion: 0.40
Nodes (5): .claude/launch.json, ast_hash, mtime, seen, semantic_hash

### Community 113 - "CLAUDE.md"
Cohesion: 0.40
Nodes (5): CLAUDE.md, ast_hash, mtime, seen, semantic_hash

### Community 114 - ".claude/QUICK_START.md"
Cohesion: 0.40
Nodes (5): .claude/QUICK_START.md, ast_hash, mtime, seen, semantic_hash

### Community 115 - ".claude/settings.json"
Cohesion: 0.40
Nodes (5): .claude/settings.json, ast_hash, mtime, seen, semantic_hash

### Community 116 - "clients/dreamsign-pilot/brief.json"
Cohesion: 0.40
Nodes (5): clients/dreamsign-pilot/brief.json, ast_hash, mtime, seen, semantic_hash

### Community 117 - "clients/dreamsign-pilot/memory.md"
Cohesion: 0.40
Nodes (5): clients/dreamsign-pilot/memory.md, ast_hash, mtime, seen, semantic_hash

### Community 118 - "clients/dreamsign-pilot/pages/clean-agency.html"
Cohesion: 0.40
Nodes (5): clients/dreamsign-pilot/pages/clean-agency.html, ast_hash, mtime, seen, semantic_hash

### Community 119 - "clients/_template/memory.md"
Cohesion: 0.40
Nodes (5): clients/_template/memory.md, ast_hash, mtime, seen, semantic_hash

### Community 120 - "docs/INDEX.md"
Cohesion: 0.40
Nodes (5): docs/INDEX.md, ast_hash, mtime, seen, semantic_hash

### Community 121 - "docs/WFACT-3.0-Continuation-Build-Plan.md"
Cohesion: 0.40
Nodes (5): docs/WFACT-3.0-Continuation-Build-Plan.md, ast_hash, mtime, seen, semantic_hash

### Community 122 - "docs/WFACT SOPS/Claude outputs/WFACT-3.0-Fast-Track-Plan.md"
Cohesion: 0.40
Nodes (5): docs/WFACT SOPS/Claude outputs/WFACT-3.0-Fast-Track-Plan.md, ast_hash, mtime, seen, semantic_hash

### Community 123 - "docs/WFACT SOPS/Claude outputs/WFACT-SOP-1-Sales-Onboarding.md"
Cohesion: 0.40
Nodes (5): docs/WFACT SOPS/Claude outputs/WFACT-SOP-1-Sales-Onboarding.md, ast_hash, mtime, seen, semantic_hash

### Community 124 - "docs/WFACT SOPS/Claude outputs/WFACT-SOP-2-Production-Pipeline.md"
Cohesion: 0.40
Nodes (5): docs/WFACT SOPS/Claude outputs/WFACT-SOP-2-Production-Pipeline.md, ast_hash, mtime, seen, semantic_hash

### Community 125 - "docs/WFACT SOPS/Claude outputs/WFACT-SOP-3-Post-Launch-Automation-Team-Ops.md"
Cohesion: 0.40
Nodes (5): docs/WFACT SOPS/Claude outputs/WFACT-SOP-3-Post-Launch-Automation-Team-Ops.md, ast_hash, mtime, seen, semantic_hash

### Community 126 - ".github/workflows/ci.yml"
Cohesion: 0.40
Nodes (5): .github/workflows/ci.yml, ast_hash, mtime, seen, semantic_hash

### Community 127 - "packages/db/migrations/0001_init_schema.sql"
Cohesion: 0.40
Nodes (5): packages/db/migrations/0001_init_schema.sql, ast_hash, mtime, seen, semantic_hash

### Community 128 - "packages/db/migrations/0002_entity_consistency_triggers.sql"
Cohesion: 0.40
Nodes (5): packages/db/migrations/0002_entity_consistency_triggers.sql, ast_hash, mtime, seen, semantic_hash

### Community 129 - "packages/db/migrations/0003_rls_policies.sql"
Cohesion: 0.40
Nodes (5): packages/db/migrations/0003_rls_policies.sql, ast_hash, mtime, seen, semantic_hash

### Community 130 - "packages/db/migrations/0004_security_advisor_fixes.sql"
Cohesion: 0.40
Nodes (5): packages/db/migrations/0004_security_advisor_fixes.sql, ast_hash, mtime, seen, semantic_hash

### Community 131 - "packages/db/migrations/0005_fix_rls_recursion.sql"
Cohesion: 0.40
Nodes (5): packages/db/migrations/0005_fix_rls_recursion.sql, ast_hash, mtime, seen, semantic_hash

### Community 132 - "packages/frontend-loop/package.json"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/package.json, ast_hash, mtime, seen, semantic_hash

### Community 133 - "packages/frontend-loop/src/brief.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/src/brief.ts, ast_hash, mtime, seen, semantic_hash

### Community 134 - "packages/frontend-loop/src/cli.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/src/cli.ts, ast_hash, mtime, seen, semantic_hash

### Community 135 - "packages/frontend-loop/src/correctionLog.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/src/correctionLog.ts, ast_hash, mtime, seen, semantic_hash

### Community 136 - "packages/frontend-loop/src/loop.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/src/loop.ts, ast_hash, mtime, seen, semantic_hash

### Community 137 - "packages/frontend-loop/src/modelClient.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/src/modelClient.ts, ast_hash, mtime, seen, semantic_hash

### Community 138 - "packages/frontend-loop/src/paths.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/src/paths.ts, ast_hash, mtime, seen, semantic_hash

### Community 139 - "packages/frontend-loop/src/templates.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/src/templates.ts, ast_hash, mtime, seen, semantic_hash

### Community 140 - "packages/frontend-loop/test/brief.test.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/test/brief.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 141 - "packages/frontend-loop/test/correctionLog.test.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/test/correctionLog.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 142 - "packages/frontend-loop/test/loop.test.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/test/loop.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 143 - "packages/frontend-loop/test/templates.test.ts"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/test/templates.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 144 - "packages/frontend-loop/tsconfig.json"
Cohesion: 0.40
Nodes (5): packages/frontend-loop/tsconfig.json, ast_hash, mtime, seen, semantic_hash

### Community 145 - "packages/hermes/package.json"
Cohesion: 0.40
Nodes (5): packages/hermes/package.json, ast_hash, mtime, seen, semantic_hash

### Community 146 - "packages/hermes/scripts/verify-supabase-connection.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/scripts/verify-supabase-connection.ts, ast_hash, mtime, seen, semantic_hash

### Community 147 - "packages/hermes/src/cli.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/src/cli.ts, ast_hash, mtime, seen, semantic_hash

### Community 148 - "packages/hermes/src/controller.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/src/controller.ts, ast_hash, mtime, seen, semantic_hash

### Community 149 - "packages/hermes/src/escalation.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/src/escalation.ts, ast_hash, mtime, seen, semantic_hash

### Community 150 - "packages/hermes/src/modelClient.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/src/modelClient.ts, ast_hash, mtime, seen, semantic_hash

### Community 151 - "packages/hermes/src/state.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/src/state.ts, ast_hash, mtime, seen, semantic_hash

### Community 152 - "packages/hermes/src/toneFilter.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/src/toneFilter.ts, ast_hash, mtime, seen, semantic_hash

### Community 153 - "packages/hermes/src/tools/memoryTools.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/src/tools/memoryTools.ts, ast_hash, mtime, seen, semantic_hash

### Community 154 - "packages/hermes/src/tools/registry.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/src/tools/registry.ts, ast_hash, mtime, seen, semantic_hash

### Community 155 - "packages/hermes/src/tools/schema.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/src/tools/schema.ts, ast_hash, mtime, seen, semantic_hash

### Community 156 - "packages/hermes/src/tools/stateTools.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/src/tools/stateTools.ts, ast_hash, mtime, seen, semantic_hash

### Community 157 - "packages/hermes/test/controller.test.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/test/controller.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 158 - "packages/hermes/test/escalation.test.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/test/escalation.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 159 - "packages/hermes/test/memoryTools.test.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/test/memoryTools.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 160 - "packages/hermes/test/schema.test.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/test/schema.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 161 - "packages/hermes/test/toneFilter.test.ts"
Cohesion: 0.40
Nodes (5): packages/hermes/test/toneFilter.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 162 - "packages/hermes/tsconfig.json"
Cohesion: 0.40
Nodes (5): packages/hermes/tsconfig.json, ast_hash, mtime, seen, semantic_hash

### Community 163 - "packages/verification/package.json"
Cohesion: 0.40
Nodes (5): packages/verification/package.json, ast_hash, mtime, seen, semantic_hash

### Community 164 - "packages/verification/src/checks/imageOptimization.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/checks/imageOptimization.ts, ast_hash, mtime, seen, semantic_hash

### Community 165 - "packages/verification/src/checks/isolation.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/checks/isolation.ts, ast_hash, mtime, seen, semantic_hash

### Community 166 - "packages/verification/src/checks/noConsoleErrors.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/checks/noConsoleErrors.ts, ast_hash, mtime, seen, semantic_hash

### Community 167 - "packages/verification/src/checks/requiredSections.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/checks/requiredSections.ts, ast_hash, mtime, seen, semantic_hash

### Community 168 - "packages/verification/src/checks/responsive.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/checks/responsive.ts, ast_hash, mtime, seen, semantic_hash

### Community 169 - "packages/verification/src/checks/secretsScan.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/checks/secretsScan.ts, ast_hash, mtime, seen, semantic_hash

### Community 170 - "packages/verification/src/checks/types.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/checks/types.ts, ast_hash, mtime, seen, semantic_hash

### Community 171 - "packages/verification/src/cli.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/cli.ts, ast_hash, mtime, seen, semantic_hash

### Community 172 - "packages/verification/src/evaluator.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/evaluator.ts, ast_hash, mtime, seen, semantic_hash

### Community 173 - "packages/verification/src/modelClient.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/modelClient.ts, ast_hash, mtime, seen, semantic_hash

### Community 174 - "packages/verification/src/paths.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/paths.ts, ast_hash, mtime, seen, semantic_hash

### Community 175 - "packages/verification/src/registry.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/registry.ts, ast_hash, mtime, seen, semantic_hash

### Community 176 - "packages/verification/src/verificationLoop.ts"
Cohesion: 0.40
Nodes (5): packages/verification/src/verificationLoop.ts, ast_hash, mtime, seen, semantic_hash

### Community 177 - "packages/verification/test/evaluator.test.ts"
Cohesion: 0.40
Nodes (5): packages/verification/test/evaluator.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 178 - "packages/verification/test/registry.test.ts"
Cohesion: 0.40
Nodes (5): packages/verification/test/registry.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 179 - "packages/verification/test/verificationLoop.test.ts"
Cohesion: 0.40
Nodes (5): packages/verification/test/verificationLoop.test.ts, ast_hash, mtime, seen, semantic_hash

### Community 180 - "packages/verification/tsconfig.json"
Cohesion: 0.40
Nodes (5): packages/verification/tsconfig.json, ast_hash, mtime, seen, semantic_hash

### Community 181 - "PROGRESS.md"
Cohesion: 0.40
Nodes (5): PROGRESS.md, ast_hash, mtime, seen, semantic_hash

### Community 182 - "README.md"
Cohesion: 0.40
Nodes (5): README.md, ast_hash, mtime, seen, semantic_hash

### Community 183 - "scripts/rls_attack_test.sql"
Cohesion: 0.40
Nodes (5): scripts/rls_attack_test.sql, ast_hash, mtime, seen, semantic_hash

### Community 185 - "content.ts"
Cohesion: 0.07
Nodes (36): Areas, briefFactText(), Contact, CONTENT_SCHEMA_VERSION, Cta, digits(), extractJson(), FactSchema (+28 more)

### Community 186 - "Sample Lead: Harbor Street Bakery (synthetic, Bennett & Co)"
Cohesion: 0.50
Nodes (4): Bennett & Co (entity), Sample Lead: Harbor Street Bakery (synthetic, Bennett & Co), DreamSign (entity), Sample Lead: Northlight Signs (synthetic, DreamSign)

### Community 187 - "pg_temp.attack_tracks"
Cohesion: 0.50
Nodes (3): pg_temp.attack_tracks(), public.audit_log, public.plan_approvals

### Community 188 - "dispatch-job/index.ts"
Cohesion: 0.67
Nodes (3): allowedOrigin(), EXTRA_ORIGINS, respond()

### Community 217 - "render.ts"
Cohesion: 0.13
Nodes (34): Fact, Page, Section, callLine(), comment(), contactFacts(), Ctx, esc() (+26 more)

### Community 218 - "frontend-loop/src/cli.ts"
Cohesion: 0.16
Nodes (11): main(), appendCorrectionLogRows(), formatCorrectionSummary(), formatRoundRow(), CorrectionRound, Agent37ModelClient, ClaudeModelClient, modelClientFromEnv() (+3 more)

### Community 219 - "PilotBrief"
Cohesion: 0.38
Nodes (7): PilotBrief, FrontendLoopResult, createTrackABuilderAgent(), SiteContent, briefBlock(), TrackALoop, trackASystemPrompt()

### Community 220 - "FrontendLoop"
Cohesion: 0.41
Nodes (3): createFrontendBuilderAgent(), FrontendLoop, PageTemplate

### Community 221 - "palette.ts"
Cohesion: 0.38
Nodes (10): BrandColors, buildPalette(), contrast(), luminance(), mix(), Palette, reach(), Rgb (+2 more)

### Community 222 - "brief.ts"
Cohesion: 0.36
Nodes (6): BRIEF_SOURCES, InvalidBriefError, loadBrief(), parseBrief(), REQUIRED_STRING_FIELDS, validBrief

### Community 223 - "rendered-qa/test/trackA.test.ts"
Cohesion: 0.22
Nodes (4): brief, repo, site, playwright

## Ambiguous Edges - Review These
- `WFACT SOP (PDF)` → `WFact SOP 1 — Sales & Onboarding (PDF)`  [AMBIGUOUS]
  docs/WFACT SOPS/WFACT SOP.pdf · relation: conceptually_related_to
- `Step 4C: Cockpit UI/UX redesign` → `Migration 0010 (account requests, approval function)`  [AMBIGUOUS]
  packages/db/RLS_ATTACK_TEST_RESULTS.md · relation: conceptually_related_to

## Knowledge Gaps
- **1038 isolated node(s):** `notification-token-display.sh script`, `post-write-token-diff.sh script`, `pre-tool-bash-guard.sh script`, `pre-tool-read-guard.sh script`, `pre-tool-token-guard.sh script` (+1033 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1250 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `WFACT SOP (PDF)` and `WFact SOP 1 — Sales & Onboarding (PDF)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Step 4C: Cockpit UI/UX redesign` and `Migration 0010 (account requests, approval function)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `packages/hermes/src/toneFilter.ts` connect `packages/hermes/src/toneFilter.ts` to `manifest.json`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `WFACT 3.0 Continuation Build Plan` connect `WFACT 3.0 Continuation Build Plan` to `WFACT 3.0 Complete Ecosystem Blueprint`, `WFACT 3.0 Factory Completion Plan`, `CLAUDE.md law file`, `Archive README`, `Cockpit Jobs (COCKPIT-JOBS.md)`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `playwright` connect `rendered-qa/test/trackA.test.ts` to `rendered-qa/package.json`, `rendered.ts`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `render.design-review check (cross-vendor screenshot reviewer)` (e.g. with `DQ-ART-DIRECTION: Art direction follows brief` and `DQ-CONTENT-HIERARCHY: Content hierarchy`) actually correct?**
  _`render.design-review check (cross-vendor screenshot reviewer)` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `CLAUDE.md law file` (e.g. with `graphify reference: commit hook and CLAUDE.md integration` and `Repo law & structure guardrails job (gitleaks, required files, plaintext secret block)`) actually correct?**
  _`CLAUDE.md law file` has 2 INFERRED edges - model-reasoned connections that need verification._