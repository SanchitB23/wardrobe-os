/**
 * Gemini implementation of {@link ChatModel} using `@google/genai` chat
 * sessions. Server-side only; the SDK is imported lazily and the key is read
 * from `GEMINI_API_KEY` at call time (never bundled to the browser).
 *
 * We use the SDK's chat session so it manages conversation history and the
 * role/formatting of function-call and function-response turns for us; we only
 * map to/from our provider-neutral shapes.
 */

import { ProviderError } from "@/ai/types";
import type {
  ChatModel,
  ChatSession,
  ChatSendInput,
  ChatToolCall,
  ChatTurnResult,
  StartSessionInput,
} from "@/ai/chat/chat-model";

const DEFAULT_MODEL = "gemini-2.5-flash";

/** Minimal shapes of the `@google/genai` surface we consume. */
interface GenAiFunctionCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}
interface GenAiResponse {
  text?: string;
  functionCalls?: GenAiFunctionCall[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}
interface GenAiChat {
  sendMessage(params: { message: unknown }): Promise<GenAiResponse>;
}
interface GenAiClient {
  chats: {
    create(params: {
      model: string;
      history?: unknown[];
      config?: Record<string, unknown>;
    }): GenAiChat;
  };
}

export interface GeminiChatModelConfig {
  apiKey?: string;
  model?: string;
  /** Injectable client for tests. */
  client?: GenAiClient;
}

function mapUsage(usage: GenAiResponse["usageMetadata"]) {
  if (!usage) return undefined;
  return {
    promptTokens: usage.promptTokenCount ?? 0,
    completionTokens: usage.candidatesTokenCount ?? 0,
    totalTokens: usage.totalTokenCount ?? 0,
  };
}

function toTurn(response: GenAiResponse): ChatTurnResult {
  const calls = (response.functionCalls ?? []).filter((c) => c.name);
  if (calls.length > 0) {
    const toolCalls: ChatToolCall[] = calls.map((c) => ({
      id: c.id,
      name: c.name as string,
      args: c.args ?? {},
    }));
    return { toolCalls, usage: mapUsage(response.usageMetadata) };
  }
  return { text: response.text ?? "", usage: mapUsage(response.usageMetadata) };
}

class GeminiChatSession implements ChatSession {
  constructor(private readonly chat: GenAiChat) {}

  async send(input: ChatSendInput): Promise<ChatTurnResult> {
    try {
      if ("text" in input) {
        const response = await this.chat.sendMessage({ message: input.text });
        return toTurn(response);
      }
      // Function responses — one part per tool result.
      const parts = input.toolResults.map((result) => ({
        functionResponse: {
          id: result.id,
          name: result.name,
          response: result.ok
            ? { result: result.data ?? null }
            : { error: result.error ?? "tool failed" },
        },
      }));
      const response = await this.chat.sendMessage({ message: parts });
      return toTurn(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ProviderError("gemini", `Gemini chat failed: ${message}`, {
        retryable: true,
        cause: error,
      });
    }
  }
}

export class GeminiChatModel implements ChatModel {
  readonly id = "gemini";
  private readonly config: GeminiChatModelConfig;
  private cachedClient?: GenAiClient;

  constructor(config: GeminiChatModelConfig = {}) {
    this.config = config;
  }

  async startSession(input: StartSessionInput): Promise<ChatSession> {
    if (typeof window !== "undefined") {
      throw new ProviderError(
        "gemini",
        "GeminiChatModel must only run on the server.",
        { retryable: false },
      );
    }
    const client = await this.getClient();
    const model = input.model ?? this.config.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

    const chat = client.chats.create({
      model,
      history: input.history.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      config: {
        systemInstruction: input.system,
        tools: [
          {
            functionDeclarations: input.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          },
        ],
      },
    });

    return new GeminiChatSession(chat);
  }

  private async getClient(): Promise<GenAiClient> {
    if (this.config.client) return this.config.client;
    if (this.cachedClient) return this.cachedClient;
    const apiKey = this.config.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ProviderError(
        "gemini",
        "GEMINI_API_KEY is not set (server-side only).",
        { retryable: false },
      );
    }
    const { GoogleGenAI } = await import("@google/genai");
    this.cachedClient = new GoogleGenAI({ apiKey }) as unknown as GenAiClient;
    return this.cachedClient;
  }
}
