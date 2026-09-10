import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  ToolRegistry,
  ToolNotAllowlistedError,
  ToolInputValidationError,
  ToolOutputValidationError,
} from "../src/tools/schema.js";

const echoTool = {
  name: "test.echo",
  description: "Echoes a validated string back.",
  inputSchema: z.object({ value: z.string().min(1) }),
  outputSchema: z.object({ value: z.string() }),
  handler: async ({ value }: { value: string }) => ({ value }),
};

test("invoking an unregistered tool is refused, not attempted", async () => {
  const registry = new ToolRegistry();
  await assert.rejects(
    () => registry.invoke("shell.exec", { cmd: "rm -rf /" }),
    ToolNotAllowlistedError,
  );
});

test("registered tool with valid input runs and returns validated output", async () => {
  const registry = new ToolRegistry();
  registry.register(echoTool);
  const result = await registry.invoke("test.echo", { value: "hello" });
  assert.deepEqual(result, { value: "hello" });
});

test("invalid input is rejected before the handler runs", async () => {
  const registry = new ToolRegistry();
  let handlerRan = false;
  registry.register({
    ...echoTool,
    handler: async (input: { value: string }) => {
      handlerRan = true;
      return { value: input.value };
    },
  });
  await assert.rejects(() => registry.invoke("test.echo", { value: "" }), ToolInputValidationError);
  assert.equal(handlerRan, false, "handler must not run when input validation fails");
});

test("a handler that violates its own output contract is caught, not passed through", async () => {
  const registry = new ToolRegistry();
  registry.register({
    ...echoTool,
    // @ts-expect-error deliberately returning a shape that violates outputSchema
    handler: async () => ({ value: 42 }),
  });
  await assert.rejects(() => registry.invoke("test.echo", { value: "x" }), ToolOutputValidationError);
});

test("registering the same tool name twice is refused", () => {
  const registry = new ToolRegistry();
  registry.register(echoTool);
  assert.throws(() => registry.register(echoTool));
});

test("listAllowlisted only ever reflects what was explicitly registered", () => {
  const registry = new ToolRegistry();
  registry.register(echoTool);
  const listed = registry.listAllowlisted();
  assert.deepEqual(
    listed.map((t) => t.name),
    ["test.echo"],
  );
});
