/**
 * Response caches. Pure — no database, no network.
 *
 * EXTENSION POINT: swap {@link InMemoryAICache} for a durable/shared cache
 * (Redis, Supabase table, edge KV) by implementing {@link AICache}. The
 * orchestrator only depends on the interface, so nothing else changes.
 */

import type { AICache, AIResponse } from "@/ai/types";

/** Process-local cache backed by a Map. Not shared across instances/requests. */
export class InMemoryAICache implements AICache {
  private readonly store = new Map<string, AIResponse>();

  async get(key: string): Promise<AIResponse | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: AIResponse): Promise<void> {
    this.store.set(key, value);
  }

  /** Test/maintenance helper — not part of the AICache contract. */
  clear(): void {
    this.store.clear();
  }
}

/** A cache that stores nothing — the default when caching is not wanted. */
export const noopCache: AICache = {
  async get() {
    return undefined;
  },
  async set() {
    // intentionally empty
  },
};
