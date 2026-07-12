/**
 * AI Playground runner — server-side only (req 5).
 *
 * Builds the selected prompt, runs it through AIRuntime (capability: structured),
 * and returns everything the debug UI displays: prompts, input, raw + parsed
 * response, schema validation, latency, cache hit/miss, and any error. It
 * deliberately does NOT pass a parser to the runtime, so an invalid JSON
 * response is shown with its validation errors rather than throwing. Provider
 * failures are caught and returned (the prompt/input still come back).
 *
 * Caching is OFF unless explicitly enabled (req 2 / prior task's playground rule).
 *
 * The runtime is injectable so tests run without a network or API key.
 */

import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";
import { createJsonResponseParser } from "@/ai/schemas";
import type { AIRuntime } from "@/runtime/ai";
import { getPlaygroundBuilder } from "@/features/playground/builders";
import type {
  PlaygroundRunRequest,
  PlaygroundRunResult,
} from "@/features/playground/types";

/** Playground cache entries are short-lived — this is a debug tool. */
const PLAYGROUND_TTL_SECONDS = 60 * 60; // 1 hour

export interface PlaygroundDeps {
  runtime?: Pick<AIRuntime, "run">;
  now?: string;
}

export async function runPlayground(
  request: PlaygroundRunRequest,
  deps: PlaygroundDeps = {},
): Promise<PlaygroundRunResult> {
  const builder = getPlaygroundBuilder(request.builderId);
  if (!builder) {
    return {
      builderId: request.builderId,
      userPrompt: "",
      input: request.input,
      error: `Unknown prompt builder: ${request.builderId}`,
    };
  }

  const built = builder.build(request.input);
  const model = request.model?.trim() || undefined;

  const base: PlaygroundRunResult = {
    builderId: builder.id,
    provider: request.provider,
    model,
    systemPrompt: built.system,
    userPrompt: built.prompt,
    input: request.input,
  };

  const runtime = deps.runtime ?? getServerAIRuntime();

  try {
    const response = await runtime.run({
      capability: "structured",
      request: {
        system: built.system,
        prompt: built.prompt,
        model,
        responseFormat: "json",
        temperature: 0.4,
        maxTokens: 700,
      },
      forceRefresh: request.forceRefresh,
      cache: request.cacheEnabled
        ? {
            promptBuilder: builder.id,
            promptVersion: builder.version,
            model,
            input: request.input,
            ttlSeconds: PLAYGROUND_TTL_SECONDS,
          }
        : undefined,
    });

    // Validate the raw response against the builder's schema (for display).
    const parser = createJsonResponseParser(builder.schema);
    const parsed = parser.parse(response.text);

    return {
      ...base,
      provider: response.servedBy ?? request.provider,
      model: response.model ?? model,
      responseText: response.text,
      responseJson: parsed.ok ? parsed.data : undefined,
      validation: parsed.ok
        ? { valid: true }
        : { valid: false, errors: parsed.errors },
      latencyMs: response.latencyMs,
      cached: request.cacheEnabled ? Boolean(response.cached) : undefined,
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
