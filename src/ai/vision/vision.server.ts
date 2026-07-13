/**
 * Server-side vision composition root (RFC-002 / RFC-029). The only place a
 * vision provider meets real credentials; import from route handlers only.
 * Gemini is primary; OpenAI is a budget-gated fallback, wired only when
 * OPENAI_API_KEY is present (so no key ⇒ Gemini-only, unchanged).
 */

import type { VisionProvider } from "@/domain/vision";
import { GeminiVisionProvider } from "@/ai/vision/gemini-vision-provider";
import { OpenAIVisionProvider } from "@/ai/vision/openai-vision-provider";
import { FallbackVisionProvider } from "@/ai/vision/fallback-vision-provider";
import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";

let cached: VisionProvider | undefined;

export function getServerVisionProvider(): VisionProvider {
  if (typeof window !== "undefined") {
    throw new Error("Vision provider is server-side only and must not be imported into client code.");
  }
  if (cached) return cached;

  const primary = new GeminiVisionProvider();
  const fallback = process.env.OPENAI_API_KEY ? new OpenAIVisionProvider() : undefined;

  cached = new FallbackVisionProvider({
    primary,
    fallback,
    // Budget-gated (RFC-014A): same OpenAI availability signal as text routing.
    // Lazy call at analyze-time avoids an eager import cycle.
    isFallbackAvailable: () => getServerAIRuntime().getPolicyResolver().isProviderAvailable("openai"),
  });
  return cached;
}

/** Test/maintenance helper. */
export function resetServerVisionProvider(): void {
  cached = undefined;
}
