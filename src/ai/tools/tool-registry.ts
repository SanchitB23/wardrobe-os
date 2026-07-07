/**
 * ToolRegistry — the set of tools available to the model.
 *
 * Holds {@link AITool} instances and emits their definitions in provider-neutral
 * form as well as Gemini function-declaration and OpenAI tool shapes, so the
 * same registry drives any provider (req: Gemini function calling now, OpenAI
 * tools later).
 */

import type {
  AITool,
  GeminiFunctionDeclaration,
  OpenAITool,
  ToolDefinition,
} from "@/ai/tools/types";

export class ToolRegistry {
  private readonly tools = new Map<string, AITool>();

  constructor(tools: AITool[] = []) {
    for (const tool of tools) this.register(tool);
  }

  register(tool: AITool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  list(): AITool[] {
    return [...this.tools.values()];
  }

  /** Provider-neutral definitions. */
  definitions(): ToolDefinition[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /** Gemini `tools: [{ functionDeclarations }]` payload. */
  toGeminiFunctionDeclarations(): GeminiFunctionDeclaration[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /** OpenAI `tools: [{ type: "function", function }]` payload. */
  toOpenAITools(): OpenAITool[] {
    return this.list().map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}
