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
 * `permissionScope` is DESCRIPTIVE ONLY at this stage — it documents what each role may touch, but
 * nothing enforces it yet (Blueprint §14's policy engine is explicitly "do not build yet" for this
 * stage). Stated here so it can't be mistaken for an enforced boundary.
 */

export interface AgentDefinition {
  /** Stable role id — the only string a task may use to address this agent. */
  role: string;
  description: string;
  /** What the agent knows how to do (Blueprint §3: an agent is a role plus a skillset). */
  skillset: string[];
  /** Descriptive, not enforced (see header). Format: "<kind>:<scope>". */
  permissionScope: string[];
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
    if (this.definitions.has(def.role)) {
      throw new Error(`Agent role "${def.role}" is already registered — refusing a silent overwrite.`);
    }
    this.definitions.set(def.role, structuredClone(def));
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
    permissionScope: ["model:builder", "model:evaluator", "fs:read:clients/*/brief.json"],
    modelSlots: ["builder", "evaluator"],
  },
  {
    role: "qa-evaluator",
    description:
      "Verifies a built page: 6 deterministic registry checks, then an independent evaluator model " +
      "(packages/verification). Never the same instance as the builder.",
    skillset: ["registry-checks", "independent-evaluation"],
    permissionScope: ["model:evaluator", "fs:read:clients/*/pages/*", "audit:write"],
    modelSlots: ["evaluator"],
  },
];

export function createSeedRegistry(): AgentRegistry {
  return new AgentRegistry(SEED_AGENT_DEFINITIONS);
}
