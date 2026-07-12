/**
 * Redaction (RFC-022) — strip / hash secrets and sensitive payloads before emit.
 *
 * Never log: API keys, access codes, cookies, Authorization, image base64,
 * raw prompts (by default), full wardrobe payloads.
 */

import { createHash } from "node:crypto";

const SENSITIVE_KEY_RE =
  /^(.*_)?(api[_-]?key|secret|password|token|authorization|cookie|access[_-]?code|app[_-]?access|session)(_.*)?$/i;

const PROMPT_KEYS = new Set([
  "prompt",
  "system",
  "messages",
  "content",
  "history",
  "imagebase64",
  "imagedata",
  "base64",
  "rawprompt",
  "wardrobe",
  "items",
  "styledna",
]);

const MAX_STRING_LEN = 256;
const DATA_URL_RE = /^data:[^;]+;base64,/i;
const BASE64_BLOB_RE = /^[A-Za-z0-9+/]{200,}={0,2}$/;

export function hashValue(value: string, prefix = "h"): string {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 12);
  return `${prefix}:${digest}`;
}

/** Hash (or null) a User-Agent for safe logging. */
export function redactUserAgent(ua: string | null | undefined, redacted = true): string | null {
  if (!ua) return null;
  if (!redacted) return ua.length > MAX_STRING_LEN ? `${ua.slice(0, MAX_STRING_LEN)}…` : ua;
  return hashValue(ua, "ua_h");
}

/** Hash (or null) a client IP / x-forwarded-for value. */
export function redactIp(ip: string | null | undefined, redacted = true): string | null {
  if (!ip) return null;
  // Take the first hop only — still hash it.
  const first = ip.split(",")[0]?.trim() ?? ip;
  if (!redacted) return first;
  return hashValue(first, "ip_h");
}

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEY_RE.test(key)) return true;
  if (PROMPT_KEYS.has(key.toLowerCase())) return true;
  return false;
}

function looksLikeSecretString(value: string): boolean {
  if (DATA_URL_RE.test(value)) return true;
  if (BASE64_BLOB_RE.test(value)) return true;
  if (/sk-[A-Za-z0-9]{20,}/.test(value)) return true;
  if (/AIza[0-9A-Za-z_-]{20,}/.test(value)) return true;
  return false;
}

/**
 * Deep-redact an arbitrary metadata bag. Arrays become `[redacted:n]`;
 * sensitive keys become `[REDACTED]`; long / secret-looking strings are hashed
 * or replaced.
 */
export function redactValue(value: unknown, redacted = true, depth = 0): unknown {
  if (!redacted) return value;
  if (depth > 6) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (looksLikeSecretString(value)) return "[REDACTED]";
    if (value.length > MAX_STRING_LEN) return `${value.slice(0, 64)}…[truncated:${value.length}]`;
    return value;
  }
  if (Array.isArray(value)) {
    return `[redacted:${value.length}]`;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactValue(v, true, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

/**
 * Assert a serialized log line does not contain known secret patterns
 * (used by tests; also a last-line defence when emitting).
 */
export function containsLeakedSecret(serialized: string): boolean {
  if (/sk-[A-Za-z0-9]{20,}/.test(serialized)) return true;
  if (/AIza[0-9A-Za-z_-]{20,}/.test(serialized)) return true;
  if (/data:image\/[^;]+;base64,[A-Za-z0-9+/]{80,}/i.test(serialized)) return true;
  return false;
}
