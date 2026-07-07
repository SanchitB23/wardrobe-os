/**
 * Anthropic Claude provider — STUB.
 *
 * EXTENSION POINT: install `@anthropic-ai/sdk`, read the key from an env var at
 * call time, map {@link AIRequest} to the Messages API (system + messages,
 * image blocks for vision, tool/JSON for structured output), and return an
 * {@link AIResponse}. Keep the stub SDK-free until then.
 */

import { StubAIProvider } from "@/ai/providers/base-provider";
import type { AICapabilities, AIProviderId } from "@/ai/types";

export class ClaudeProvider extends StubAIProvider {
  readonly id: AIProviderId = "claude";
  readonly capabilities: AICapabilities = {
    generate: true,
    stream: true,
    vision: true,
    structuredOutput: true,
  };
}
