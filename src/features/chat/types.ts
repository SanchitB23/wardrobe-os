/**
 * Shared types for the AI Stylist Chat. Plain data so the client, the streaming
 * route, and the server service all speak the same shapes.
 */

import type { AIUsage } from "@/ai/types";

export type ChatRole = "user" | "assistant";

/** A visible conversation turn sent to / from the server (session memory). */
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatRequestBody {
  /** Full session conversation; the last entry is the new user message. */
  messages: ChatTurn[];
}

/** A message as held in the client session (richer than the wire ChatTurn). */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  streaming?: boolean;
  error?: string;
  toolTrace?: ToolTraceEntry[];
  usage?: AIUsage;
  latencyMs?: number;
  cached?: boolean;
}

/** One tool invocation, shown in Debug mode. */
export interface ToolTraceEntry {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  data?: unknown;
  error?: string;
  latencyMs: number;
}

/** Events streamed from the chat route (NDJSON, one JSON object per line). */
export type ChatStreamEvent =
  | { type: "tool_call"; id?: string; name: string; args: Record<string, unknown> }
  | {
      type: "tool_result";
      name: string;
      ok: boolean;
      data?: unknown;
      error?: string;
      latencyMs: number;
    }
  | { type: "token"; text: string }
  | {
      type: "done";
      usage?: AIUsage;
      latencyMs: number;
      cached: boolean;
      steps: number;
      toolTrace: ToolTraceEntry[];
    }
  | { type: "error"; error: string; requestId?: string };
