/**
 * Correlation IDs (RFC-022) — resolve or generate a requestId.
 *
 * Accepts an incoming `x-request-id` when UUID-shaped; otherwise generates a
 * new UUID. Oversized / malformed values are rejected to avoid log injection.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_INCOMING_LENGTH = 128;

export const REQUEST_ID_HEADER = "x-request-id";

/** True when the value is a well-formed UUID (RFC-style). */
export function isWellFormedRequestId(value: string): boolean {
  if (!value || value.length > MAX_INCOMING_LENGTH) return false;
  return UUID_RE.test(value.trim());
}

/** Generate a new correlation id (crypto.randomUUID when available). */
export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes — still unique enough for correlation.
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Resolve a requestId: honour a well-formed incoming header, else generate.
 */
export function resolveRequestId(incoming: string | null | undefined): string {
  if (incoming && isWellFormedRequestId(incoming)) {
    return incoming.trim();
  }
  return generateRequestId();
}
