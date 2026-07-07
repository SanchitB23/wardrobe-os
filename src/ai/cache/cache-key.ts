/**
 * Deterministic AI cache key derivation. Pure and dependency-free (no crypto),
 * so it is safe in any bundle. The key is a hash of the prompt builder, its
 * version, the model, and the structured input payload — identical inputs
 * always produce the same key; any change produces a different one.
 */

/** Stable stringify: object keys sorted recursively so key order can't vary. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * FNV-1a (32-bit) rendered as 8 hex chars, combined with a second offset-basis
 * pass so the effective key is 64 bits — small collision risk for a cache.
 */
export function hashString(input: string): string {
  const fnv = (seed: number): number => {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  };
  const a = fnv(0x811c9dc5);
  const b = fnv(0x811c9dc5 ^ 0x9e3779b9);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

export interface CacheKeyParts {
  promptBuilder: string;
  promptVersion: string;
  model: string;
  input: unknown;
}

/**
 * Build the cache key and the input hash. `inputHash` is stored separately (a
 * DB column) for debugging/inspection; `key` also folds in builder/version/model.
 */
export function buildAICacheKey(parts: CacheKeyParts): {
  key: string;
  inputHash: string;
} {
  const inputHash = hashString(stableStringify(parts.input));
  const composite = stableStringify({
    b: parts.promptBuilder,
    v: parts.promptVersion,
    m: parts.model,
    i: inputHash,
  });
  return {
    key: `${parts.promptBuilder}:${parts.promptVersion}:${hashString(composite)}`,
    inputHash,
  };
}
