/**
 * The allowlist, in full. If a tool isn't registered here, Hermes-lite cannot call it — there is
 * no other path to invocation (see ToolRegistry.invoke in schema.ts). Keep this file short and
 * legible; it is the thing a security review should be able to read end to end in one pass.
 */
import { ToolRegistry } from "./schema.js";
import { readContextTool, readClientMemoryTool } from "./memoryTools.js";
import { createProjectStatusTool } from "./stateTools.js";
import type { StateReader } from "../state.js";

export function buildToolRegistry(stateReader: StateReader | null): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readContextTool);
  registry.register(readClientMemoryTool);
  if (stateReader) {
    registry.register(createProjectStatusTool(stateReader));
  }
  return registry;
}
