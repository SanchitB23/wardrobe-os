/**
 * ToolExecutor — safely runs a single {@link ToolCall}.
 *
 * It resolves the tool from the registry, validates the model-supplied args
 * against the tool's JSON schema, executes it, and ALWAYS returns a structured
 * {@link ToolResult} (never throws to the caller/model). Errors — unknown tool,
 * invalid args, or a thrown execution — become `{ ok: false, code, error }`,
 * which is exactly what you feed back to a function-calling model.
 */

import { validateAgainstSchema } from "@/ai/tools/json-schema";
import type { ToolRegistry } from "@/ai/tools/tool-registry";
import type {
  ToolCall,
  ToolContext,
  ToolLogger,
  ToolResult,
} from "@/ai/tools/types";

export interface ToolExecutorOptions {
  /** Validate args against the tool schema before executing (default true). */
  validateArgs?: boolean;
  logger?: ToolLogger;
}

export class ToolExecutor {
  private readonly registry: ToolRegistry;
  private readonly validateArgs: boolean;
  private readonly logger?: ToolLogger;

  constructor(registry: ToolRegistry, options: ToolExecutorOptions = {}) {
    this.registry = registry;
    this.validateArgs = options.validateArgs ?? true;
    this.logger = options.logger;
  }

  async execute(call: ToolCall, context?: ToolContext): Promise<ToolResult> {
    const base = { name: call.name, id: call.id };
    const tool = this.registry.get(call.name);

    if (!tool) {
      this.logger?.log({
        level: "warn",
        message: "unknown tool",
        data: { name: call.name },
      });
      return {
        ...base,
        ok: false,
        code: "unknown_tool",
        error: `Unknown tool: ${call.name}`,
      };
    }

    const args = call.args ?? {};
    if (this.validateArgs) {
      const validation = validateAgainstSchema(args, tool.parameters);
      if (!validation.valid) {
        return {
          ...base,
          ok: false,
          code: "invalid_args",
          error: `Invalid arguments for ${call.name}: ${validation.errors.join("; ")}`,
        };
      }
    }

    try {
      const data = await tool.execute(args, context);
      this.logger?.log({
        level: "info",
        message: "tool ok",
        data: { name: call.name },
      });
      return { ...base, ok: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.log({
        level: "error",
        message: "tool execution error",
        data: { name: call.name, error: message },
      });
      return { ...base, ok: false, code: "execution_error", error: message };
    }
  }
}
