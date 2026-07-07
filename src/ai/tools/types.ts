/**
 * Provider-neutral tool-calling contracts.
 *
 * A {@link AITool} is a named, JSON-schema-described capability the model may
 * invoke instead of reasoning from raw data. Tools bridge AI → app services:
 * the model never touches the database; it emits a {@link ToolCall}, which the
 * executor routes to a tool whose `execute` calls a feature service.
 *
 * Nothing here imports a provider SDK — the registry emits Gemini/OpenAI shapes
 * via adapters, so the same tools work across providers.
 */

import type { JSONSchema } from "@/ai/tools/json-schema";

/** Per-invocation context passed to a tool's execute (extensible). */
export interface ToolContext {
  signal?: AbortSignal;
}

/**
 * A single callable tool. `parameters` is the JSON schema for `args`; the
 * executor validates against it before calling `execute`.
 */
export interface AITool<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
> {
  readonly name: string;
  readonly description: string;
  readonly parameters: JSONSchema;
  execute(args: TArgs, context?: ToolContext): Promise<TResult>;
}

/** A model's request to invoke a tool. `id` is the provider's call id (OpenAI). */
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

export type ToolErrorCode =
  | "unknown_tool"
  | "invalid_args"
  | "execution_error";

export type ToolResult =
  | { name: string; id?: string; ok: true; data: unknown }
  | {
      name: string;
      id?: string;
      ok: false;
      error: string;
      code: ToolErrorCode;
    };

/** Provider-neutral tool definition (name + description + JSON-schema params). */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
}

// --- Provider wire formats (produced by the registry adapters) -------------

/** Gemini `FunctionDeclaration` shape. */
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: JSONSchema;
}

/** OpenAI tool shape (`type: "function"`). */
export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

/** Structured logger for tool execution (optional). */
export interface ToolLogger {
  log(record: {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    data?: Record<string, unknown>;
  }): void;
}
