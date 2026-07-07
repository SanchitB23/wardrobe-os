/**
 * Provider-neutral chat model contracts for tool-calling conversations.
 *
 * A {@link ChatModel} opens a {@link ChatSession} seeded with system text, prior
 * turns, and the tool declarations the model may call. Each `send` returns
 * either tool calls the model wants executed, or the final assistant text —
 * never both. The agentic loop (execute tools → send results → repeat) lives in
 * the ChatService, which is the only place tools (and therefore services) are
 * reached; the model itself never touches the database.
 *
 * Nothing here imports a provider SDK — Gemini/OpenAI implementations live
 * behind this interface, so swapping providers is additive.
 */

import type { JSONSchema } from "@/ai/tools/json-schema";
import type { AIUsage } from "@/ai/types";

/** A tool advertised to the model (provider-neutral). */
export interface ChatToolSpec {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export type ChatRole = "user" | "assistant";

/** A visible conversation turn (session memory). */
export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
}

/** A tool call the model requested. */
export interface ChatToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

/** A tool result fed back to the model. */
export interface ChatToolResultInput {
  id?: string;
  name: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

/** Input to a single `send`: either the user's text or tool results. */
export type ChatSendInput =
  | { text: string }
  | { toolResults: ChatToolResultInput[] };

/** The model's response to one `send`. */
export interface ChatTurnResult {
  /** Present when the model wants tools executed. */
  toolCalls?: ChatToolCall[];
  /** Present when the model produced its final answer. */
  text?: string;
  usage?: AIUsage;
}

export interface ChatSession {
  send(input: ChatSendInput): Promise<ChatTurnResult>;
}

export interface StartSessionInput {
  system?: string;
  history: ChatHistoryMessage[];
  tools: ChatToolSpec[];
  model?: string;
}

export interface ChatModel {
  readonly id: string;
  startSession(input: StartSessionInput): Promise<ChatSession>;
}
