/**
 * The agent registry — Blueprint §14 ("a list of every defined agent role, its skillset, and its
 * permission scope"), seeded honestly small per Continuation Plan Stage 2: exactly the two agents
 * that exist today. Same allowlist idea as packages/hermes/src/tools/registry.ts: runAgent refuses a
 * task whose role isn't registered, so an agent can't run just because some code constructed it.
 *
 * Adding an agent does NOT require editing this file: build an AgentDefinition next to the agent's
 * own code and `register()` it on the registry instance at composition time (see
 * test/runAgent.test.ts's "new agent" case). The seed list is only the roles that exist right now.
 *
 * `permissionScope` is ENFORCED (Factory Completion Plan Step 6). It is a typed, versioned, default-deny
 * allowlist (`AgentScope`, see permissions.ts): model slots, tables and operations, readable and writable
 * path patterns, tools, and a per-run spend ceiling. `register()` validates it (a malformed scope, a scope
 * written for another policy version, or a clients/ pattern that does not name the bound client is
 * refused), and `runAgent` builds a PermissionGate from it for every run. Anything a role's scope does not
 * list is denied and audited as `agent.deny`. The role x capability inventory is docs/AGENT-PERMISSIONS.md.
 */
import { defineScope, validateScope, type AgentScope } from "./permissions.js";

export interface AgentDefinition {
  /** Stable role id — the only string a task may use to address this agent. */
  role: string;
  description: string;
  /** What the agent knows how to do (Blueprint §3: an agent is a role plus a skillset). */
  skillset: string[];
  /** Enforced and default-deny (see header and permissions.ts). Build it with `defineScope`. */
  permissionScope: AgentScope;
  /** Routing slots this role draws from (Blueprint §7) — which model fills each is config, not code. */
  modelSlots: string[];
}

export class AgentNotRegisteredError extends Error {
  constructor(public readonly role: string) {
    super(`Agent role "${role}" is not registered — refusing to run it. See packages/agent-runtime/src/registry.ts.`);
    this.name = "AgentNotRegisteredError";
  }
}

export class AgentRegistry {
  private readonly definitions = new Map<string, AgentDefinition>();

  constructor(initial: AgentDefinition[] = []) {
    for (const def of initial) this.register(def);
  }

  register(def: AgentDefinition): void {
    if (!/^[a-z][a-z0-9-]*$/.test(def.role)) {
      throw new Error(`Agent role "${def.role}" must be lowercase-hyphenated.`);
    }
    // Throws ScopeValidationError: a role with a malformed scope is never registered, so it can never run.
    validateScope(def.role, def.permissionScope);
    for (const slot of def.permissionScope.models) {
      if (!def.modelSlots.includes(slot)) {
        throw new Error(`Agent role "${def.role}": scope grants model slot "${slot}" that is not in its modelSlots.`);
      }
    }
    if (this.definitions.has(def.role)) {
      throw new Error(`Agent role "${def.role}" is already registered — refusing a silent overwrite.`);
    }
    this.definitions.set(def.role, Object.freeze(structuredClone(def)));
  }

  get(role: string): AgentDefinition {
    const def = this.definitions.get(role);
    if (!def) throw new AgentNotRegisteredError(role);
    return def;
  }

  has(role: string): boolean {
    return this.definitions.has(role);
  }

  list(): AgentDefinition[] {
    return [...this.definitions.values()];
  }
}

/** Exactly the agents that exist in this repo today — no aspirational roles. */
export const SEED_AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    role: "front-end-builder",
    description:
      "Builds one client page from a brief + template, self-correcting against an independent " +
      "reviewer until approved or the round cap escalates (packages/frontend-loop).",
    skillset: ["html-page-generation", "template-reskin", "correction-rounds"],
    // The page/site files are written by the workflow on this role's behalf, through this scope
    // (packages/workflow/src/buildAndVerify.ts). The brief arrives as task input: the builder reads no client file.
    permissionScope: defineScope({
      models: ["builder", "evaluator"],
      fsWrite: ["clients/{client}/pages/*", "clients/{client}/sites/**"],
      tools: ["build.trackBIsolated"],
      maxCostUsdPerRun: 5,
    }),
    modelSlots: ["builder", "evaluator"],
  },
  {
    role: "qa-evaluator",
    description:
      "Verifies a built page: the evaluation registry's deterministic checks (Step 7), then an independent evaluator model " +
      "(packages/verification). Never the same instance as the builder.",
    skillset: ["registry-checks", "independent-evaluation"],
    // Reads the checkpointed page/site (via the workflow) and the client's brief as its fact source (verify job),
    // writes its own verification.decision row, renders the page in the QA browser, asks the screenshot reviewer.
    permissionScope: defineScope({
      models: ["evaluator", "reviewer"],
      db: [{ table: "audit_log", ops: ["insert"] }],
      fsRead: ["clients/{client}/pages/*", "clients/{client}/sites/**", "clients/{client}/brief.json"],
      tools: ["qa.renderedBrowser"],
      maxCostUsdPerRun: 2,
    }),
    modelSlots: ["evaluator", "reviewer"],
  },
];

export function createSeedRegistry(): AgentRegistry {
  return new AgentRegistry(SEED_AGENT_DEFINITIONS);
}
