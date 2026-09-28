# Controller Test Fixtures

> 6 nodes · cohesion 0.47

## Key Concepts

- **controller.test.ts** (12 connections) — `packages/hermes/test/controller.test.ts`
- **ProjectStatusRow** (4 connections) — `packages/hermes/src/state.ts`
- **FakeStateReader** (4 connections) — `packages/hermes/test/controller.test.ts`
- **.constructor()** (2 connections) — `packages/hermes/test/controller.test.ts`
- **.getProjectStatuses()** (2 connections) — `packages/hermes/test/controller.test.ts`
- **fakeRows** (1 connections) — `packages/hermes/test/controller.test.ts`

## Relationships

- [Supabase State Reader](Supabase_State_Reader.md) (4 shared connections)
- [Hermes CLI & Model Client](Hermes_CLI_&_Model_Client.md) (3 shared connections)
- [Hermes Memory Tools](Hermes_Memory_Tools.md) (2 shared connections)
- [Hermes Controller & Escalation](Hermes_Controller_&_Escalation.md) (2 shared connections)

## Source Files

- `packages/hermes/src/state.ts`
- `packages/hermes/test/controller.test.ts`

## Audit Trail

- EXTRACTED: 18 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*