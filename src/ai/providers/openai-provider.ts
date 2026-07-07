/**
 * OpenAI provider — STUB.
 *
 * EXTENSION POINT: install `openai`, read the key from an env var at call time,
 * map {@link AIRequest} to the Responses/Chat Completions API, and return an
 * {@link AIResponse}. Keep the stub SDK-free until then.
 */

import { StubAIProvider } from "@/ai/providers/base-provider";
import type { AICapabilities, AIProviderId } from "@/ai/types";

export class OpenAIProvider extends StubAIProvider {
  readonly id: AIProviderId = "openai";
  readonly capabilities: AICapabilities = {
    generate: true,
    stream: true,
    vision: true,
    structuredOutput: true,
  };
}
