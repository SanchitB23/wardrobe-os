/**
 * In-memory AI response cache. Pure — no database, no network.
 *
 * Stores {@link AICacheEntry} values and never returns expired ones. A clock is
 * injectable so expiry is deterministically testable.
 *
 * EXTENSION POINT: for a durable/shared cache use {@link SupabaseAICache}
 * (src/ai/cache/supabase-ai-cache.ts) or implement {@link AICache} yourself.
 */

import type { AICache, AICacheEntry } from "@/ai/types";

function isExpired(entry: AICacheEntry, nowMs: number): boolean {
  if (!entry.expiresAt) return false;
  const expiry = Date.parse(entry.expiresAt);
  return Number.isFinite(expiry) && expiry <= nowMs;
}

/** Process-local cache backed by a Map. Not shared across instances/requests. */
export class InMemoryAICache implements AICache {
  private readonly store = new Map<string, AICacheEntry>();
  private readonly now: () => number;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  async get(key: string): Promise<AICacheEntry | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (isExpired(entry, this.now())) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async set(entry: AICacheEntry): Promise<void> {
    this.store.set(entry.key, entry);
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
