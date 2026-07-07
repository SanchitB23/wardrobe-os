import { describe, expect, it, vi } from "vitest";

import { objectParams, validateAgainstSchema } from "@/ai/tools/json-schema";
import { ToolExecutor } from "@/ai/tools/tool-executor";
import { ToolRegistry } from "@/ai/tools/tool-registry";
import { ToolRouter } from "@/ai/tools/tool-router";
import type { AITool } from "@/ai/tools/types";

function echoTool(overrides: Partial<AITool> = {}): AITool {
  return {
    name: "echo",
    description: "Echoes its query back.",
    parameters: objectParams(
      {
        query: { type: "string", description: "text to echo" },
        limit: { type: "integer" },
      },
      { required: ["query"] },
    ),
    async execute(args) {
      return { echoed: args.query, limit: args.limit ?? null };
    },
    ...overrides,
  } as AITool;
}

describe("validateAgainstSchema", () => {
  const schema = objectParams(
    {
      q: { type: "string" },
      n: { type: "integer" },
      mode: { type: "string", enum: ["a", "b"] },
      tags: { type: "array", items: { type: "string" } },
    },
    { required: ["q"] },
  );

  it("accepts valid args", () => {
    expect(validateAgainstSchema({ q: "x", n: 2, mode: "a", tags: ["t"] }, schema)).toEqual({
      valid: true,
    });
  });

  it("flags a missing required field", () => {
    const r = validateAgainstSchema({ n: 1 }, schema);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors.join(" ")).toContain("q: required");
  });

  it("flags a wrong type and a bad enum and a non-integer", () => {
    const r = validateAgainstSchema({ q: 1, n: 1.5, mode: "c" }, schema);
    expect(r.valid).toBe(false);
    if (!r.valid) {
      const joined = r.errors.join(" | ");
      expect(joined).toContain("q: expected string");
      expect(joined).toContain("n: expected integer");
      expect(joined).toContain("mode: must be one of");
    }
  });

  it("rejects unexpected properties when additionalProperties is false", () => {
    const r = validateAgainstSchema({ q: "x", surprise: 1 }, schema);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors.join(" ")).toContain("surprise: unexpected property");
  });

  it("validates array item types", () => {
    const r = validateAgainstSchema({ q: "x", tags: ["ok", 3] }, schema);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors.join(" ")).toContain("tags[1]: expected string");
  });
});

describe("ToolRegistry", () => {
  it("registers, looks up, and lists tools", () => {
    const registry = new ToolRegistry([echoTool()]);
    expect(registry.has("echo")).toBe(true);
    expect(registry.get("echo")?.name).toBe("echo");
    expect(registry.list()).toHaveLength(1);
  });

  it("rejects duplicate names", () => {
    const registry = new ToolRegistry([echoTool()]);
    expect(() => registry.register(echoTool())).toThrow(/already registered/);
  });

  it("emits Gemini function declarations", () => {
    const registry = new ToolRegistry([echoTool()]);
    const decls = registry.toGeminiFunctionDeclarations();
    expect(decls[0]).toMatchObject({
      name: "echo",
      description: expect.any(String),
      parameters: { type: "object" },
    });
  });

  it("emits OpenAI tools", () => {
    const registry = new ToolRegistry([echoTool()]);
    const tools = registry.toOpenAITools();
    expect(tools[0]).toMatchObject({
      type: "function",
      function: { name: "echo", parameters: { type: "object" } },
    });
  });
});

describe("ToolExecutor", () => {
  it("executes a valid call and returns data", async () => {
    const executor = new ToolExecutor(new ToolRegistry([echoTool()]));
    const result = await executor.execute({ name: "echo", args: { query: "hi" } });
    expect(result).toMatchObject({ name: "echo", ok: true, data: { echoed: "hi" } });
  });

  it("returns unknown_tool for a missing tool", async () => {
    const executor = new ToolExecutor(new ToolRegistry());
    const result = await executor.execute({ name: "nope", args: {} });
    expect(result).toMatchObject({ ok: false, code: "unknown_tool" });
  });

  it("returns invalid_args when validation fails", async () => {
    const executor = new ToolExecutor(new ToolRegistry([echoTool()]));
    const result = await executor.execute({ name: "echo", args: {} });
    expect(result).toMatchObject({ ok: false, code: "invalid_args" });
  });

  it("captures a thrown execution error", async () => {
    const throwing = echoTool({
      name: "boom",
      async execute() {
        throw new Error("kaboom");
      },
    });
    const executor = new ToolExecutor(new ToolRegistry([throwing]));
    const result = await executor.execute({ name: "boom", args: { query: "x" } });
    expect(result).toMatchObject({ ok: false, code: "execution_error", error: "kaboom" });
  });

  it("preserves the provider call id and logs", async () => {
    const log = vi.fn();
    const executor = new ToolExecutor(new ToolRegistry([echoTool()]), {
      logger: { log },
    });
    const result = await executor.execute({ name: "echo", args: { query: "x" }, id: "call_1" });
    expect(result.id).toBe("call_1");
    expect(log).toHaveBeenCalled();
  });
});

describe("ToolRouter", () => {
  it("routes many calls concurrently, preserving order and isolating failures", async () => {
    const registry = new ToolRegistry([echoTool()]);
    const router = new ToolRouter(registry);
    const results = await router.routeAll([
      { name: "echo", args: { query: "a" } },
      { name: "missing", args: {} },
      { name: "echo", args: { query: "b" } },
    ]);
    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
    expect(results[0]).toMatchObject({ data: { echoed: "a" } });
    expect(results[1]).toMatchObject({ code: "unknown_tool" });
  });

  it("exposes provider definitions", () => {
    const router = new ToolRouter(new ToolRegistry([echoTool()]));
    expect(router.geminiFunctionDeclarations()).toHaveLength(1);
    expect(router.openAITools()[0].type).toBe("function");
  });
});
