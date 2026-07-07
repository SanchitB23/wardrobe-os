import { describe, expect, it, vi } from "vitest";

import { InMemoryAICache } from "@/ai/cache/ai-cache";
import { SupabaseAICache } from "@/ai/cache/supabase-ai-cache";
import { buildAICacheKey } from "@/ai/cache/cache-key";
import type { AICacheEntry } from "@/ai/types";

function entry(overrides: Partial<AICacheEntry> = {}): AICacheEntry {
  const { key } = buildAICacheKey({
    promptBuilder: "b",
    promptVersion: "v1",
    model: "gemini-2.5-flash",
    input: { a: 1 },
  });
  return {
    key,
    provider: "gemini",
    model: "gemini-2.5-flash",
    promptBuilder: "b",
    promptVersion: "v1",
    inputHash: "hash",
    response: {
      text: "hi",
      provider: "gemini",
      model: "gemini-2.5-flash",
      finishReason: "stop",
    },
    metadata: { usage: 1 },
    createdAt: new Date(1000).toISOString(),
    expiresAt: null,
    ...overrides,
  };
}

/** A minimal in-memory fake of the Supabase query builder ai_cache uses. */
function fakeSupabase() {
  const rows = new Map<string, Record<string, unknown>>();
  const client = {
    from() {
      let pendingKey: string | null = null;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (_col: string, val: string) => {
          pendingKey = val;
          return builder;
        },
        maybeSingle: async () => ({
          data: pendingKey ? (rows.get(pendingKey) ?? null) : null,
          error: null,
        }),
        upsert: async (row: Record<string, unknown>) => {
          rows.set(row.cache_key as string, row);
          return { error: null };
        },
        delete: () => ({
          eq: async (_col: string, val: string) => {
            rows.delete(val);
            return { error: null };
          },
        }),
      };
      return builder;
    },
  };
  return { client, rows };
}

describe("SupabaseAICache", () => {
  it("round-trips an entry through the (fake) table", async () => {
    const { client } = fakeSupabase();
    const cache = new SupabaseAICache({
      getClient: async () => client as never,
    });

    const e = entry();
    await cache.set(e);
    const got = await cache.get(e.key);
    expect(got?.key).toBe(e.key);
    expect(got?.response.text).toBe("hi");
    expect(got?.metadata).toEqual({ usage: 1 });
  });

  it("does not return expired rows and deletes them", async () => {
    const { client, rows } = fakeSupabase();
    let nowMs = 10_000;
    const cache = new SupabaseAICache({
      getClient: async () => client as never,
      now: () => nowMs,
    });

    const e = entry({ expiresAt: new Date(20_000).toISOString() });
    await cache.set(e);
    expect(await cache.get(e.key)).toBeTruthy();

    nowMs = 30_000; // past expiry
    expect(await cache.get(e.key)).toBeUndefined();
    expect(rows.has(e.key)).toBe(false); // cleaned up
  });

  it("degrades to the in-memory fallback when Supabase errors", async () => {
    const fallback = new InMemoryAICache();
    const throwing = {
      from() {
        throw new Error("relation \"ai_cache\" does not exist");
      },
    };
    const onDegrade = vi.fn();
    const cache = new SupabaseAICache({
      getClient: async () => throwing as never,
      fallback,
      onDegrade,
    });

    const e = entry();
    await cache.set(e); // error → writes to fallback
    expect(onDegrade).toHaveBeenCalledOnce();

    const got = await cache.get(e.key); // served from fallback
    expect(got?.key).toBe(e.key);
  });
});
