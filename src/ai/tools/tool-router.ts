/**
 * ToolRouter — the entry point a provider integration talks to.
 *
 * Given the tool-call requests a model emits (already normalised to
 * {@link ToolCall}s by a provider adapter), it routes each to the
 * {@link ToolExecutor} and returns the results. It also exposes the registry's
 * provider-shaped definitions so the caller can advertise the tools to the
 * model. Provider-neutral: normalising a Gemini `functionCall` or an OpenAI
 * `tool_call` into a `ToolCall` happens in the provider layer, not here.
 */

import { ToolExecutor } from "@/ai/tools/tool-executor";
import type { ToolRegistry } from "@/ai/tools/tool-registry";
import type {
  GeminiFunctionDeclaration,
  OpenAITool,
  ToolCall,
  ToolContext,
  ToolResult,
} from "@/ai/tools/types";

export class ToolRouter {
  private readonly registry: ToolRegistry;
  private readonly executor: ToolExecutor;

  constructor(registry: ToolRegistry, executor?: ToolExecutor) {
    this.registry = registry;
    this.executor = executor ?? new ToolExecutor(registry);
  }

  /** Route one tool call to its executor. */
  route(call: ToolCall, context?: ToolContext): Promise<ToolResult> {
    return this.executor.execute(call, context);
  }

  /**
   * Route many tool calls concurrently. Never rejects — each call resolves to
   * its own {@link ToolResult} (ok or error), preserving order.
   */
  routeAll(calls: ToolCall[], context?: ToolContext): Promise<ToolResult[]> {
    return Promise.all(calls.map((call) => this.executor.execute(call, context)));
  }

  /** Advertise the tools to a Gemini model. */
  geminiFunctionDeclarations(): GeminiFunctionDeclaration[] {
    return this.registry.toGeminiFunctionDeclarations();
  }

  /** Advertise the tools to an OpenAI model. */
  openAITools(): OpenAITool[] {
    return this.registry.toOpenAITools();
  }
}
