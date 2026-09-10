import { test } from "node:test";
import assert from "node:assert/strict";
import { readContextTool, readClientMemoryTool } from "../src/tools/memoryTools.js";
import { ToolRegistry, ToolInputValidationError } from "../src/tools/schema.js";

test("memory.readContext reads the real memory/context.md", async () => {
  const registry = new ToolRegistry();
  registry.register(readContextTool);
  const result = (await registry.invoke("memory.readContext", {})) as { content: string; path: string };
  assert.equal(result.path, "memory/context.md");
  assert.match(result.content, /WFACT — Business Context/);
});

test("memory.readClient reports not-found for a client that has no file yet", async () => {
  const registry = new ToolRegistry();
  registry.register(readClientMemoryTool);
  const result = (await registry.invoke("memory.readClient", { clientSlug: "dreamsign" })) as {
    found: boolean;
    content: string | null;
  };
  assert.equal(result.found, false);
  assert.equal(result.content, null);
});

test("memory.readClient refuses '_template' — it doesn't even match a valid slug shape", async () => {
  // The slug pattern requires a leading letter, so "_template" is rejected at the schema layer
  // before the handler's own belt-and-braces "_template is a form, not a client" check ever runs.
  const registry = new ToolRegistry();
  registry.register(readClientMemoryTool);
  await assert.rejects(
    () => registry.invoke("memory.readClient", { clientSlug: "_template" }),
    ToolInputValidationError,
  );
});

test("memory.readClient's own _template guard also holds if the pattern ever allowed it", async () => {
  const result = await readClientMemoryTool.handler({ clientSlug: "_template" });
  assert.equal(result.found, false);
  assert.equal(result.content, null);
});

test("memory.readClient rejects a path-traversal attempt at the schema layer", async () => {
  const registry = new ToolRegistry();
  registry.register(readClientMemoryTool);
  await assert.rejects(
    () => registry.invoke("memory.readClient", { clientSlug: "../../etc/passwd" }),
    ToolInputValidationError,
  );
  await assert.rejects(
    () => registry.invoke("memory.readClient", { clientSlug: "../CLAUDE" }),
    ToolInputValidationError,
  );
});
