# Hermes Controller & Escalation

> 20 nodes · cohesion 0.18

## Key Concepts

- **controller.ts** (18 connections) — `packages/hermes/src/controller.ts`
- **toneFilter.ts** (8 connections) — `packages/hermes/src/toneFilter.ts`
- **.answerStatusQuestion()** (6 connections) — `packages/hermes/src/controller.ts`
- **escalation.ts** (6 connections) — `packages/hermes/src/escalation.ts`
- **EscalationError** (5 connections) — `packages/hermes/src/escalation.ts`
- **withBoundedRetry()** (5 connections) — `packages/hermes/src/escalation.ts`
- **applyToneFilter()** (5 connections) — `packages/hermes/src/toneFilter.ts`
- **detectEntitySlug()** (3 connections) — `packages/hermes/src/controller.ts`
- **buildPlainLanguageSystemPrompt()** (3 connections) — `packages/hermes/src/toneFilter.ts`
- **ToneFilterResult** (3 connections) — `packages/hermes/src/toneFilter.ts`
- **escalation.test.ts** (3 connections) — `packages/hermes/test/escalation.test.ts`
- **toneFilter.test.ts** (3 connections) — `packages/hermes/test/toneFilter.test.ts`
- **HermesAnswer** (2 connections) — `packages/hermes/src/controller.ts`
- **escapeRegExp()** (2 connections) — `packages/hermes/src/toneFilter.ts`
- **JARGON_GLOSSARY** (2 connections) — `packages/hermes/src/toneFilter.ts`
- **KNOWN_ENTITIES** (1 connections) — `packages/hermes/src/controller.ts`
- **defaultSleep()** (1 connections) — `packages/hermes/src/escalation.ts`
- **.constructor()** (1 connections) — `packages/hermes/src/escalation.ts`
- **RetryOptions** (1 connections) — `packages/hermes/src/escalation.ts`
- **GLOSSARY_ENTRIES** (1 connections) — `packages/hermes/src/toneFilter.ts`

## Relationships

- [Hermes CLI & Model Client](Hermes_CLI_&_Model_Client.md) (7 shared connections)
- [Controller Test Fixtures](Controller_Test_Fixtures.md) (2 shared connections)
- [Hermes Memory Tools](Hermes_Memory_Tools.md) (1 shared connections)
- [Tool Allowlist Schema](Tool_Allowlist_Schema.md) (1 shared connections)

## Source Files

- `packages/hermes/src/controller.ts`
- `packages/hermes/src/escalation.ts`
- `packages/hermes/src/toneFilter.ts`
- `packages/hermes/test/escalation.test.ts`
- `packages/hermes/test/toneFilter.test.ts`

## Audit Trail

- EXTRACTED: 44 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*