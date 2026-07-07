/**
 * Base class for provider stubs. Every method throws {@link NotImplementedError}
 * until a real SDK is wired in — see src/ai/README.md for the extension steps.
 * No SDK imports, no API keys, no network.
 */

import {
  NotImplementedError,
  type AICapabilities,
  type AIProvider,
  type AIProviderId,
  type AIRequest,
  type AIResponse,
  type AIStreamChunk,
} from "@/ai/types";

export abstract class StubAIProvider implements AIProvider {
  abstract readonly id: AIProviderId;
  abstract readonly capabilities: AICapabilities;

  async generate(request: AIRequest): Promise<AIResponse> {
    void request;
    throw new NotImplementedError(this.id, "generate");
  }

  // `async *` makes this an async generator regardless of a yield being present.
  async *stream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    void request;
    throw new NotImplementedError(this.id, "stream");
  }

  async vision(request: AIRequest): Promise<AIResponse> {
    void request;
    throw new NotImplementedError(this.id, "vision");
  }
}
