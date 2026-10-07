/**
 * Agent permissions, enforced (Factory Completion Plan Step 6; Blueprint §3 "tool calling, security/permissions",
 * §12 "least-privilege, per-agent scoped access"). Until Step 6 every role's `permissionScope` was a descriptive
 * string list nothing checked. It is now a typed, versioned, default-deny allowlist, and this file is the ONE place
 * that decides whether an agent may do something:
 *
 *   decide(scope, binding, capability)  -> allowed | denied with a reason      (pure, no I/O, unit-tested)
 *   PermissionGate.authorize(capability) -> resolves, or audits `agent.deny` and throws PermissionDeniedError
 *
 * Every agent I/O path asks a gate before it acts: model calls (`guardModelClient`, applied inside the agent
 * factories so no composition root can forget it), the runtime-provided audit sink, the workflow's artifact
 * reads and writes, the planning pipeline's plan_approvals writes, Hermes-lite's tool calls, the Track B isolated
 * build and the rendered-QA browser. `runAgent` creates the gate for each run and publishes it in an
 * AsyncLocalStorage, the same way `runContext` publishes the task to the model tracer.
 *
 * Deliberately NOT a policy engine (Step 6: "keep it a small, testable allowlist"): no rule language, no
 * inheritance, no runtime-editable policy. A scope is plain data next to the role's definition.
 *
 * Entity isolation lives here as well as in RLS:
 *   - a run is bound to one entity and (optionally) one client folder (`binding`);
 *   - file patterns under clients/ must name the bound client as `{client}`; a pattern that could reach another
 *     client's folder (clients/<asterisk>/...) is refused at registration unless the scope is cross-entity AND read-only;
 *   - a database capability names the row's entity; it must equal the bound entity (null only matches null);
 *   - a client folder that belongs to a different entity than the task (clients/<slug>/brief.json says so)
 *     is refused before the agent starts (the "client" capability).
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import path from "node:path";
import { recordAudit, type AuditContext } from "@wfact/audit";
import { costForModel } from "@wfact/hermes-lite/routing";

/** Bump when the shape or meaning of a scope changes; every scope states the version it was written for. */
export const PERMISSION_POLICY_VERSION = "1.0.0";

export type DbOp = "select" | "insert" | "update" | "delete";
const DB_OPS: readonly DbOp[] = ["select", "insert", "update", "delete"];

/** What one role may do. Everything not listed is denied. */
export interface AgentScope {
  /** Must equal PERMISSION_POLICY_VERSION, so a scope written for another policy version is refused, not guessed at. */
  version: string;
  /** Model routing slots this role may call (Blueprint §7). */
  models: string[];
  /** Tables and operations. Every row access is also entity-checked (see header). */
  db: { table: string; ops: DbOp[] }[];
  /** Repo-relative path patterns. Segments: a literal, `*` (one segment), `**` (one or more), `{client}`. */
  fsRead: string[];
  fsWrite: string[];
  /** Named tools (Hermes-lite tools, the isolated build, the QA browser). */
  tools: string[];
  /** Hard ceiling on metered model spend for one run, USD. A call is refused once the run has spent this much. */
  maxCostUsdPerRun: number;
  /**
   * Only for a read-only controller (Hermes-lite answers the owner's questions about any entity). A cross-entity
   * scope may not write anything: registration refuses it.
   */
  crossEntity?: boolean;
  /** Scan the task input for instruction-like text (roles that ingest raw client text). Audit-only; see injection.ts. */
  scanInputForInjection?: boolean;
}

/** One thing an agent wants to do. */
export type Capability =
  | { kind: "model"; slot: string }
  | { kind: "db"; table: string; op: DbOp; entitySlug: string | null }
  | { kind: "fs"; op: "read" | "write"; path: string }
  | { kind: "tool"; name: string }
  /** The run's metered spend so far; allowed only while it is under the role's ceiling. */
  | { kind: "spend"; usd: number }
  /** Binding check: the client folder a task names, and the entity that folder belongs to (null = unknown/new). */
  | { kind: "client"; clientSlug: string; ownerEntity: string | null };

/** Who a run works for. */
export interface Binding {
  entitySlug: string | null;
  clientSlug: string | null;
}

export type Decision = { allowed: true } | { allowed: false; reason: string };

export class PermissionDeniedError extends Error {
  constructor(
    public readonly role: string | null,
    public readonly capability: Capability,
    public readonly reason: string,
  ) {
    super(`permission denied${role ? ` for role "${role}"` : ""}: ${describeCapability(capability)} (${reason})`);
    this.name = "PermissionDeniedError";
  }
}

export class ScopeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeValidationError";
  }
}

// ---------------------------------------------------------------------------------------------
// Scopes: construction and validation
// ---------------------------------------------------------------------------------------------

/** A scope with every list empty and no budget: denies everything. Fill in only what the role needs. */
export function defineScope(partial: Partial<Omit<AgentScope, "version">> = {}): AgentScope {
  return {
    version: PERMISSION_POLICY_VERSION,
    models: partial.models ?? [],
    db: partial.db ?? [],
    fsRead: partial.fsRead ?? [],
    fsWrite: partial.fsWrite ?? [],
    tools: partial.tools ?? [],
    maxCostUsdPerRun: partial.maxCostUsdPerRun ?? 0,
    ...(partial.crossEntity ? { crossEntity: true } : {}),
    ...(partial.scanInputForInjection ? { scanInputForInjection: true } : {}),
  };
}

const SLOT_RE = /^[a-z][a-z0-9-]*$/;
const TABLE_RE = /^[a-z_][a-z0-9_]*$/;
const TOOL_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;
const SEGMENT_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const SLUG_RE = /^[a-z][a-z0-9-]*$/;
/** No single run may be granted more than this, whatever a scope says (the owner's "ask before a build over $5" rule, with headroom). */
export const MAX_COST_CEILING_USD = 25;

function validatePattern(role: string, pattern: string, crossEntity: boolean): void {
  const segs = pattern.split("/");
  if (segs[0] === "**" || segs[0] === "*") throw new ScopeValidationError(`${role}: path pattern "${pattern}" may not start with a wildcard (no repo-wide access)`);
  for (const s of segs) {
    if (s !== "*" && s !== "**" && s !== "{client}" && !SEGMENT_RE.test(s)) {
      throw new ScopeValidationError(`${role}: path pattern "${pattern}" has an invalid segment "${s}"`);
    }
  }
  if (segs[0] === "clients" && !crossEntity && segs[1] !== "{client}") {
    throw new ScopeValidationError(
      `${role}: path pattern "${pattern}" reaches into clients/ without naming the bound client as {client}; only a cross-entity read-only scope may`,
    );
  }
  if (segs.includes("{client}") && segs[0] !== "clients") {
    throw new ScopeValidationError(`${role}: {client} is only meaningful directly under clients/ ("${pattern}")`);
  }
}

/** Throws ScopeValidationError if the scope is malformed or breaks a structural rule. Called by AgentRegistry.register. */
export function validateScope(role: string, scope: AgentScope): void {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    throw new ScopeValidationError(`${role}: permissionScope must be a typed scope object (defineScope), not ${Array.isArray(scope) ? "a string list" : typeof scope}`);
  }
  if (scope.version !== PERMISSION_POLICY_VERSION) {
    throw new ScopeValidationError(`${role}: scope was written for policy version ${JSON.stringify(scope.version)}, this runtime enforces ${PERMISSION_POLICY_VERSION}`);
  }
  const lists: (keyof AgentScope)[] = ["models", "db", "fsRead", "fsWrite", "tools"];
  for (const k of lists) if (!Array.isArray(scope[k])) throw new ScopeValidationError(`${role}: scope.${k} must be a list`);
  for (const m of scope.models) if (!SLOT_RE.test(m)) throw new ScopeValidationError(`${role}: model slot "${m}" is not a slot name`);
  for (const t of scope.tools) if (!TOOL_RE.test(t)) throw new ScopeValidationError(`${role}: tool "${t}" is not a tool name`);
  const tables = new Set<string>();
  for (const d of scope.db) {
    if (!TABLE_RE.test(d.table)) throw new ScopeValidationError(`${role}: table "${d.table}" is not a table name (no wildcards)`);
    if (tables.has(d.table)) throw new ScopeValidationError(`${role}: table "${d.table}" listed twice`);
    tables.add(d.table);
    if (!Array.isArray(d.ops) || d.ops.length === 0 || !d.ops.every((o) => DB_OPS.includes(o))) {
      throw new ScopeValidationError(`${role}: table "${d.table}" needs a non-empty list of ${DB_OPS.join("/")}`);
    }
  }
  const crossEntity = scope.crossEntity === true;
  for (const p of [...scope.fsRead, ...scope.fsWrite]) validatePattern(role, p, crossEntity);
  if (crossEntity && (scope.fsWrite.length > 0 || scope.db.some((d) => d.ops.some((o) => o !== "select")))) {
    throw new ScopeValidationError(`${role}: a cross-entity scope must be read-only (no fsWrite, db select only)`);
  }
  if (typeof scope.maxCostUsdPerRun !== "number" || !Number.isFinite(scope.maxCostUsdPerRun) || scope.maxCostUsdPerRun < 0 || scope.maxCostUsdPerRun > MAX_COST_CEILING_USD) {
    throw new ScopeValidationError(`${role}: maxCostUsdPerRun must be a number from 0 to ${MAX_COST_CEILING_USD}`);
  }
}

// ---------------------------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------------------------

/** A clean repo-relative path, or null if it is absolute, escapes, or has an odd segment. */
export function normalizeRelPath(p: string): string | null {
  if (typeof p !== "string" || p.length === 0 || p.length > 512 || p.includes("\\") || p.includes("\0") || p.startsWith("/")) return null;
  const segs = p.split("/");
  if (!segs.every((s) => SEGMENT_RE.test(s) && s !== "." && s !== "..")) return null;
  return p;
}

function matchSegs(pat: string[], segs: string[]): boolean {
  if (pat.length === 0) return segs.length === 0;
  const [head, ...rest] = pat;
  if (head === "**") {
    for (let i = 1; i <= segs.length; i += 1) if (matchSegs(rest, segs.slice(i))) return true;
    return false;
  }
  if (segs.length === 0) return false;
  if (head !== "*" && head !== segs[0]) return false;
  return matchSegs(rest, segs.slice(1));
}

/** Does `relPath` match `pattern` under this binding? `{client}` only matches the bound client. */
export function matchPath(pattern: string, binding: Binding, relPath: string): boolean {
  if (pattern.includes("{client}")) {
    if (!binding.clientSlug || !SLUG_RE.test(binding.clientSlug)) return false;
    pattern = pattern.split("/").map((s) => (s === "{client}" ? binding.clientSlug! : s)).join("/");
  }
  return matchSegs(pattern.split("/"), relPath.split("/"));
}

/** Pure: may a role with this scope, working under this binding, do this? Default deny. */
export function decide(scope: AgentScope | null, binding: Binding, cap: Capability): Decision {
  const deny = (reason: string): Decision => ({ allowed: false, reason });
  if (!scope) return deny("role has no permission scope (default deny)");
  if (scope.version !== PERMISSION_POLICY_VERSION) return deny(`scope is for policy ${scope.version}, not ${PERMISSION_POLICY_VERSION}`);
  switch (cap?.kind) {
    case "model":
      return scope.models.includes(cap.slot) ? { allowed: true } : deny(`model slot "${cap.slot}" is not in this role's scope`);
    case "spend":
      return cap.usd < scope.maxCostUsdPerRun
        ? { allowed: true }
        : deny(`this run has spent $${cap.usd.toFixed(4)}, at or over the role's ceiling of $${scope.maxCostUsdPerRun}`);
    case "tool":
      return scope.tools.includes(cap.name) ? { allowed: true } : deny(`tool "${cap.name}" is not in this role's scope`);
    case "db": {
      const grant = scope.db.find((d) => d.table === cap.table);
      if (!grant) return deny(`table "${cap.table}" is not in this role's scope`);
      if (!grant.ops.includes(cap.op)) return deny(`"${cap.op}" on "${cap.table}" is not in this role's scope`);
      if (!scope.crossEntity && (cap.entitySlug ?? null) !== binding.entitySlug) {
        return deny(`row belongs to entity ${JSON.stringify(cap.entitySlug ?? null)}, this run is bound to ${JSON.stringify(binding.entitySlug)}`);
      }
      return { allowed: true };
    }
    case "fs": {
      const rel = normalizeRelPath(cap.path);
      if (!rel) return deny(`path ${JSON.stringify(cap.path)} is not a clean repo-relative path`);
      const patterns = cap.op === "write" ? scope.fsWrite : scope.fsRead;
      if (patterns.some((p) => matchPath(p, binding, rel))) return { allowed: true };
      const segs = rel.split("/");
      if (segs[0] === "clients" && segs[1] && segs[1] !== binding.clientSlug && !scope.crossEntity) {
        return deny(`clients/${segs[1]}/ is not the client this run is bound to (${JSON.stringify(binding.clientSlug)})`);
      }
      return deny(`${cap.op} of ${rel} is not in this role's scope`);
    }
    case "client": {
      if (!SLUG_RE.test(cap.clientSlug)) return deny(`client slug ${JSON.stringify(cap.clientSlug)} is malformed`);
      if (scope.crossEntity) return { allowed: true };
      if (cap.clientSlug !== binding.clientSlug) return deny(`client ${cap.clientSlug} is not the client this run is bound to`);
      if (cap.ownerEntity !== null && cap.ownerEntity !== binding.entitySlug) {
        return deny(`client ${cap.clientSlug} belongs to entity "${cap.ownerEntity}", this run is for ${JSON.stringify(binding.entitySlug)}`);
      }
      return { allowed: true };
    }
    default:
      return deny(`unknown capability kind ${JSON.stringify((cap as { kind?: unknown })?.kind)} (default deny)`);
  }
}

export function describeCapability(cap: Capability): string {
  switch (cap?.kind) {
    case "model": return `model:${cap.slot}`;
    case "spend": return `spend:$${cap.usd.toFixed(4)}`;
    case "tool": return `tool:${cap.name}`;
    case "db": return `db:${cap.op}:${cap.table}(entity=${cap.entitySlug ?? "none"})`;
    case "fs": return `fs:${cap.op}:${cap.path}`;
    case "client": return `client:${cap.clientSlug}(owner=${cap.ownerEntity ?? "unknown"})`;
    default: return `unknown:${JSON.stringify(cap)}`;
  }
}

// ---------------------------------------------------------------------------------------------
// The gate: decide + audit + throw
// ---------------------------------------------------------------------------------------------

export interface PermissionGateOptions {
  role: string;
  scope: AgentScope | null;
  binding: Binding;
  /** Where `agent.deny` rows go (actor, task, run, entity). Null = no audit sink in this process (tests, local CLIs). */
  audit: AuditContext | null;
}

export interface PermissionSummary {
  policyVersion: string;
  allowed: number;
  denied: number;
  spentUsd: number;
  maxCostUsdPerRun: number | null;
}

/** One per agent run (or per controller call). Not shared between runs: each run is its own identity (Blueprint §12). */
export class PermissionGate {
  readonly role: string;
  readonly binding: Readonly<Binding>;
  readonly denials: { capability: Capability; reason: string }[] = [];
  private allowedCount = 0;
  private spent = 0;

  constructor(private readonly opts: PermissionGateOptions) {
    this.role = opts.role;
    this.binding = Object.freeze({ ...opts.binding });
  }

  get spentUsd(): number {
    return this.spent;
  }

  check(cap: Capability): Decision {
    return decide(this.opts.scope, this.binding, cap);
  }

  /** Resolves if allowed. Otherwise writes `agent.deny` (fail closed: an audit failure throws that instead) and throws PermissionDeniedError. */
  async authorize(cap: Capability): Promise<void> {
    const d = this.check(cap);
    if (d.allowed) {
      this.allowedCount += 1;
      return;
    }
    this.denials.push({ capability: cap, reason: d.reason });
    if (this.opts.audit) {
      await recordAudit(this.opts.audit, {
        action: "agent.deny",
        outcome: "rejected",
        payload: {
          role: this.role,
          capability: describeCapability(cap),
          detail: cap,
          reason: d.reason,
          binding: { ...this.binding },
          policyVersion: PERMISSION_POLICY_VERSION,
        },
      });
    }
    throw new PermissionDeniedError(this.role, cap, d.reason);
  }

  /** Before a model call: the slot, then the run's spend against the ceiling. */
  async authorizeModelCall(slot: string): Promise<void> {
    await this.authorize({ kind: "model", slot });
    await this.authorize({ kind: "spend", usd: this.spent });
  }

  recordSpend(usd: number | null): void {
    if (typeof usd === "number" && Number.isFinite(usd) && usd > 0) this.spent = Math.round((this.spent + usd) * 1e6) / 1e6;
  }

  summary(): PermissionSummary {
    return {
      policyVersion: PERMISSION_POLICY_VERSION,
      allowed: this.allowedCount,
      denied: this.denials.length,
      spentUsd: this.spent,
      maxCostUsdPerRun: this.opts.scope?.maxCostUsdPerRun ?? null,
    };
  }
}

const gateStore = new AsyncLocalStorage<PermissionGate>();

/** Run `fn` with `gate` as the current gate (runAgent does this around every attempt). */
export function withPermissionGate<T>(gate: PermissionGate, fn: () => T): T {
  return gateStore.run(gate, fn);
}

export function currentPermissionGate(): PermissionGate | null {
  return gateStore.getStore() ?? null;
}

/** Authorize against the current run's gate. Outside any agent run there is no scope, so everything is denied. */
export async function requirePermission(cap: Capability): Promise<void> {
  const gate = currentPermissionGate();
  if (!gate) throw new PermissionDeniedError(null, cap, "no agent run is active, so there is no scope (default deny)");
  await gate.authorize(cap);
}

// ---------------------------------------------------------------------------------------------
// Model calls
// ---------------------------------------------------------------------------------------------

const GUARDED = Symbol.for("wfact.permissions.guardedSlot");
const MODEL_METHODS = ["complete", "completeJson"] as const;

type AnyClient = { name?: string; totalUsage?: Record<string, number>; modelIdUsed?: string };

/**
 * Reads a known client's cumulative token counters and prices a delta with Hermes-lite's one price table, the same
 * recognition rules as `traceModelClient`. Unknown clients (test mocks) are unmetered: their calls are still gated by
 * slot, they just add nothing to the run's spend.
 */
function meterFor(client: AnyClient): { usage: () => { inputTokens: number; outputTokens: number }; model: string } | null {
  const u = () => client.totalUsage ?? {};
  if (client.name === "claude" && client.modelIdUsed) {
    return { model: client.modelIdUsed, usage: () => ({ inputTokens: u().inputTokens ?? 0, outputTokens: u().outputTokens ?? 0 }) };
  }
  if (client.name === "agent37") {
    return { model: "hermes-agent", usage: () => ({ inputTokens: u().promptTokens ?? 0, outputTokens: u().completionTokens ?? 0 }) };
  }
  if (typeof client.name === "string" && client.name.startsWith("claude:")) {
    return { model: client.name.slice("claude:".length), usage: () => ({ inputTokens: u().inputTokens ?? 0, outputTokens: u().outputTokens ?? 0 }) };
  }
  return null;
}

/**
 * Wrap a model client so every call first asks the current run's gate for `model:<slot>` and for budget, and adds
 * the call's metered cost to the run's spend afterwards. Called inside every agent factory, so an agent built by
 * any composition root is gated. A call made outside an agent run is denied.
 */
export function guardModelClient<T extends object>(client: T, slot: string): T {
  if (!SLOT_RE.test(slot)) throw new Error(`guardModelClient: "${slot}" is not a slot name`);
  const existing = (client as Record<symbol, unknown>)[GUARDED];
  if (existing === slot) return client;
  if (typeof existing === "string") throw new Error(`guardModelClient: client is already guarded as "${existing}", refusing to re-guard it as "${slot}"`);
  const methods = MODEL_METHODS.filter((m) => typeof (client as Record<string, unknown>)[m] === "function");
  if (methods.length === 0) throw new Error("guardModelClient: client has no complete() or completeJson() method");
  const meter = meterFor(client as AnyClient);
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === GUARDED) return slot;
      if ((methods as readonly (string | symbol)[]).includes(prop)) {
        const original = Reflect.get(target, prop, receiver) as (...a: unknown[]) => Promise<unknown>;
        return async (...args: unknown[]) => {
          const gate = currentPermissionGate();
          if (!gate) throw new PermissionDeniedError(null, { kind: "model", slot }, "model call outside any agent run (default deny)");
          await gate.authorizeModelCall(slot);
          const before = meter?.usage();
          try {
            return await original.apply(target, args);
          } finally {
            if (meter && before) {
              const after = meter.usage();
              const usage = { inputTokens: Math.max(0, after.inputTokens - before.inputTokens), outputTokens: Math.max(0, after.outputTokens - before.outputTokens) };
              try {
                const price = costForModel(meter.model, usage);
                gate.recordSpend(price.basis === "metered" ? price.costUsd : null);
              } catch {
                // Price table unreadable: the call already happened and is traced; spend just isn't counted here.
              }
            }
          }
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** For the identity checks the loops make (builder !== evaluator): guard two clients without hiding that they are one. */
export function guardModelPair<T extends object>(builder: T, builderSlot: string, evaluator: T, evaluatorSlot: string): { builder: T; evaluator: T } {
  if (builder === evaluator) return { builder, evaluator };
  return { builder: guardModelClient(builder, builderSlot), evaluator: guardModelClient(evaluator, evaluatorSlot) };
}

// ---------------------------------------------------------------------------------------------
// Client directory: which entity owns a client folder
// ---------------------------------------------------------------------------------------------

export type ClientEntityResolver = (clientSlug: string) => string | null;

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

/**
 * The owner entity of clients/<slug>/, read from its brief.json (`entitySlug`). Null when there is no folder or no
 * brief yet (a brand-new client): the binding then rests on the task's own entity and the folder rule.
 */
export function fileClientEntityResolver(repoRoot: string = REPO_ROOT): ClientEntityResolver {
  return (clientSlug) => {
    if (!SLUG_RE.test(clientSlug)) return null;
    try {
      const brief = JSON.parse(readFileSync(path.join(repoRoot, "clients", clientSlug, "brief.json"), "utf-8")) as { entitySlug?: unknown };
      return typeof brief.entitySlug === "string" ? brief.entitySlug : null;
    } catch {
      return null;
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Scopes that are not agents
// ---------------------------------------------------------------------------------------------

/**
 * Hermes-lite is the controller, not an agent (it never runs through runAgent), but its tool calls go through the
 * same gate. Read-only and cross-entity: it answers the owner's status questions about any entity.
 */
export const HERMES_LITE_ROLE = "hermes-lite";
export const HERMES_LITE_SCOPE: AgentScope = defineScope({
  models: ["hermes"],
  db: [{ table: "projects", ops: ["select"] }],
  fsRead: ["memory/context.md", "clients/*/memory.md"],
  tools: ["memory.readContext", "memory.readClient", "state.projectStatus"],
  maxCostUsdPerRun: 0.1, // worst real Hermes-lite answer $0.016 (model_traces 2026-10-06); covers its 3 retries
  crossEntity: true,
});
