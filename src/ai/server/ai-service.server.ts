/**
 * Server-side AI composition root. This is the ONLY place providers are wired
 * to real credentials, and it must never be imported from client code.
 *
 * Why this exists:
 * - Reqs 6 & 7: keep every Gemini call server-side. `GEMINI_API_KEY` has no
 *   `NEXT_PUBLIC_` prefix, so Next won't bundle it into the browser; the runtime
 *   guard below is a second line of defence.
 * - Req 11: the rest of the app depends on the {@link AIService} interface, so
 *   swapping Gemini for another provider (or adding fallbacks) happens here and
 *   nowhere else.
 *
 * NOTE: no provider-level `use server` / React coupling — this is plain server
 * TypeScript consumed by route handlers (and later, server actions/services).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { InMemoryAICache } from "@/ai/cache";
import { SupabaseAICache } from "@/ai/cache/supabase-ai-cache";
import { createAIOrchestrator } from "@/ai/orchestrator";
import { GeminiProvider } from "@/ai/providers/gemini-provider";
import type { AICache, AIService } from "@/ai/types";
import { createClient } from "@/lib/supabase/server";

function assertServerSide(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "AI service is server-side only and must not be imported into client code.",
    );
  }
}

let cached: AIService | undefined;

/**
 * The app-wide {@link AIService}. Gemini-only today; the orchestrator makes
 * adding providers/fallbacks a one-line change here.
 *
 * The orchestrator's own retry is disabled (maxAttempts: 1) because
 * GeminiProvider already retries once on transient failures — this keeps call
 * volume (and cost) predictable for a hobby project.
 */
export function getServerAIService(): AIService {
  assertServerSide();
  if (cached) return cached;

  // Swap point (req 11): `AI_PROVIDER` selects the backend. Only Gemini is
  // implemented today; other ids will slot in here once their providers exist.
  const selected = (process.env.AI_PROVIDER ?? "gemini").toLowerCase();
  if (selected !== "gemini") {
    throw new Error(
      `AI_PROVIDER="${selected}" is not implemented yet. Only "gemini" is wired up.`,
    );
  }

  cached = createAIOrchestrator({
    providers: [new GeminiProvider()],
    retryPolicy: { maxAttempts: 1, initialDelayMs: 0, backoffFactor: 1 },
    cache: createServerAICache(),
  });
  return cached;
}

/**
 * Durable AI response cache (req 3): Supabase-backed `ai_cache` table with a
 * transparent in-memory fallback if the table/RLS is unavailable. A fresh
 * request-scoped Supabase client is created per operation.
 */
function createServerAICache(): AICache {
  return new SupabaseAICache({
    // The typed request client is compatible with the cache's schema-agnostic
    // client contract; cast to decouple the cache from the app's DB types.
    getClient: async () => (await createClient()) as unknown as SupabaseClient,
    fallback: new InMemoryAICache(),
    onDegrade: (error) => {
      console.warn(
        "[ai] Supabase cache unavailable; using in-memory fallback.",
        error instanceof Error ? error.message : error,
      );
    },
  });
}

/** Test/maintenance helper — drops the memoized service. */
export function resetServerAIService(): void {
  cached = undefined;
}
