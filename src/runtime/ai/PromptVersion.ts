/**
 * AI Runtime v2 (RFC-014) — prompt version identity + deterministic bucketing.
 *
 * Pure helpers: build a stable version id, and bucket a stable key into [0,1)
 * with a deterministic hash so prompt experiments are reproducible (no
 * randomness). No I/O.
 */

/** Canonical version id, e.g. `explanation@3`. */
export function versionId(builderId: string, version: string): string {
  return `${builderId}@${version}`;
}

/** djb2 string hash → unsigned 32-bit. Deterministic. */
function hash32(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** Map a stable key to a fraction in [0,1). Deterministic. */
export function bucketFraction(key: string): number {
  return hash32(key) / 0x100000000;
}

/**
 * Whether a given bucket key should receive the candidate arm of an experiment.
 * Deterministic: same key + share ⇒ same answer.
 */
export function inCandidateArm(key: string, candidateShare: number): boolean {
  if (candidateShare <= 0) return false;
  if (candidateShare >= 1) return true;
  return bucketFraction(key) < candidateShare;
}
