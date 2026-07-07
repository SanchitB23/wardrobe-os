/**
 * Google Gemini provider — STUB.
 *
 * EXTENSION POINT: to make this real, install `@google/generative-ai`, read the
 * key from an env var at call time (never hardcode), map {@link AIRequest} to
 * the SDK's request shape, and return an {@link AIResponse}. Do not import the
 * SDK until then — keep the stub SDK-free.
 */

import { StubAIProvider } from "@/ai/providers/base-provider";
import type { AICapabilities, AIProviderId } from "@/ai/types";

export class GeminiProvider extends StubAIProvider {
  readonly id: AIProviderId = "gemini";
  readonly capabilities: AICapabilities = {
    generate: true,
    stream: true,
    vision: true,
    structuredOutput: true,
  };
}
