/**
 * Provider-neutral tool-calling infrastructure. Concrete Wardrobe tools that
 * bind to feature services live in ./wardrobe (server-only) and are NOT
 * re-exported here, to keep this barrel free of server/service imports.
 */

export {
  validateAgainstSchema,
  objectParams,
  type JSONSchema,
  type JSONSchemaType,
  type SchemaValidation,
} from "@/ai/tools/json-schema";
export { ToolRegistry } from "@/ai/tools/tool-registry";
export { ToolExecutor, type ToolExecutorOptions } from "@/ai/tools/tool-executor";
export { ToolRouter } from "@/ai/tools/tool-router";
export type {
  AITool,
  ToolCall,
  ToolContext,
  ToolResult,
  ToolErrorCode,
  ToolDefinition,
  ToolLogger,
  GeminiFunctionDeclaration,
  OpenAITool,
} from "@/ai/tools/types";
