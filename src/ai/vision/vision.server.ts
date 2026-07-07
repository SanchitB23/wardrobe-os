/**
 * Server-side vision composition root (RFC-002). The only place a vision
 * provider meets real credentials; import from route handlers only, never from
 * client code. `AI_PROVIDER` selects the backend (only Gemini is implemented).
 */

import type { VisionProvider } from "@/domain/vision";
import { GeminiVisionProvider } from "@/ai/vision/gemini-vision-provider";

let cached: VisionProvider | undefined;

export function getServerVisionProvider(): VisionProvider {
  if (typeof window !== "undefined") {
    throw new Error("Vision provider is server-side only and must not be imported into client code.");
  }
  if (cached) return cached;

  const selected = (process.env.AI_PROVIDER ?? "gemini").toLowerCase();
  if (selected !== "gemini") {
    throw new Error(`AI_PROVIDER="${selected}" has no vision provider yet. Only "gemini" is wired up.`);
  }
  cached = new GeminiVisionProvider();
  return cached;
}

/** Test/maintenance helper. */
export function resetServerVisionProvider(): void {
  cached = undefined;
}
