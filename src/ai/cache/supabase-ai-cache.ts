/**
 * Supabase-backed AI response cache (req 3). Server-side only.
 *
 * Persists entries in the `ai_cache` table and never returns expired rows. If
 * Supabase is unavailable — table missing, RLS, or network — it transparently
 * degrades to a process-local {@link InMemoryAICache} for the rest of the
 * process lifetime, so callers always get a working cache.
 *
 * The Supabase client is obtained per-operation via an injected factory,
 * because the app's server client is request-scoped (cookies) while this cache
 * instance is a long-lived singleton.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { InMemoryAICache } from "@/ai/cache/ai-cache";
import type { AICache, AICacheEntry } from "@/ai/types";

const TABLE = "ai_cache";

interface AiCacheRow {
  cache_key: string;
  provider: string;
  model: string;
  prompt_builder: string;
  prompt_version: string;
  input_hash: string;
  response_json: AICacheEntry["response"];
  metadata: unknown;
  created_at: string | null;
  expires_at: string | null;
}

function rowToEntry(row: AiCacheRow): AICacheEntry {
  return {
    key: row.cache_key,
    provider: row.provider,
    model: row.model,
    promptBuilder: row.prompt_builder,
    promptVersion: row.prompt_version,
    inputHash: row.input_hash,
    response: row.response_json,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    expiresAt: row.expires_at,
  };
}

function entryToRow(entry: AICacheEntry): AiCacheRow {
  return {
    cache_key: entry.key,
    provider: entry.provider,
    model: entry.model,
    prompt_builder: entry.promptBuilder,
    prompt_version: entry.promptVersion,
    input_hash: entry.inputHash,
    response_json: entry.response,
    metadata: entry.metadata ?? null,
    created_at: entry.createdAt,
    expires_at: entry.expiresAt,
  };
}

export interface SupabaseAICacheOptions {
  /** Returns a Supabase client (request-scoped). */
  getClient: () => Promise<SupabaseClient>;
  /** Cache used both as expiry clock source and degraded fallback. */
  fallback?: InMemoryAICache;
  now?: () => number;
  onDegrade?: (error: unknown) => void;
}

export class SupabaseAICache implements AICache {
  private readonly getClient: () => Promise<SupabaseClient>;
  private readonly fallback: InMemoryAICache;
  private readonly now: () => number;
  private readonly onDegrade?: (error: unknown) => void;
  private degraded = false;

  constructor(options: SupabaseAICacheOptions) {
    this.getClient = options.getClient;
    this.fallback = options.fallback ?? new InMemoryAICache({ now: options.now });
    this.now = options.now ?? (() => Date.now());
    this.onDegrade = options.onDegrade;
  }

  async get(key: string): Promise<AICacheEntry | undefined> {
    if (this.degraded) return this.fallback.get(key);
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from(TABLE)
        .select("*")
        .eq("cache_key", key)
        .maybeSingle();
      if (error) throw error;
      if (!data) return undefined;

      const entry = rowToEntry(data as AiCacheRow);
      if (entry.expiresAt && Date.parse(entry.expiresAt) <= this.now()) {
        // Best-effort cleanup; ignore failures.
        await client.from(TABLE).delete().eq("cache_key", key);
        return undefined;
      }
      return entry;
    } catch (error) {
      this.degrade(error);
      return this.fallback.get(key);
    }
  }

  async set(entry: AICacheEntry): Promise<void> {
    if (this.degraded) return this.fallback.set(entry);
    try {
      const client = await this.getClient();
      const { error } = await client
        .from(TABLE)
        .upsert(entryToRow(entry), { onConflict: "cache_key" });
      if (error) throw error;
    } catch (error) {
      this.degrade(error);
      await this.fallback.set(entry);
    }
  }

  private degrade(error: unknown): void {
    if (!this.degraded) {
      this.degraded = true;
      this.onDegrade?.(error);
    }
  }
}
