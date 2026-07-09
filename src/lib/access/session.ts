/**
 * Application Access Guard — signed session token (RFC-010).
 *
 * A stateless, HMAC-signed cookie value that proves the visitor entered the
 * shared access code. This is NOT authentication: there is no user, no identity,
 * no database — just a signed "unlocked until <exp>" stamp.
 *
 * Pure and portable: uses Web Crypto (`crypto.subtle`), which is available in
 * both the Next.js proxy (Node runtime) and route handlers. No Node-only APIs,
 * no dependencies.
 */

/** Cookie name holding the signed session token. */
export const ACCESS_COOKIE = "wos_access";

/** Session lifetime: 30 days (RFC-010). */
export const SESSION_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface AccessPayload {
  v: 1;
  /** Expiry as ms since epoch. */
  exp: number;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Produce a signed token `base64url(payload).base64url(hmac)` that expires at
 * `expMs`. The signature covers the payload; it cannot be forged without the
 * secret, and the payload is not encrypted (it carries only a timestamp).
 */
export async function signSession(expMs: number, secret: string): Promise<string> {
  const payload: AccessPayload = { v: 1, exp: expMs };
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload)),
  );
  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

/**
 * Verify a token's signature and expiry. Uses `crypto.subtle.verify` (a
 * constant-time comparison). Returns `{ valid: false }` for a missing,
 * malformed, tampered, wrong-secret, or expired token.
 */
export async function verifySession(
  token: string | undefined | null,
  secret: string,
): Promise<{ valid: true; exp: number } | { valid: false }> {
  if (!token) return { valid: false };
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { valid: false };
  const encodedPayload = token.slice(0, dot);
  const encodedSignature = token.slice(dot + 1);

  try {
    const key = await hmacKey(secret);
    const signatureOk = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(encodedSignature),
      encoder.encode(encodedPayload),
    );
    if (!signatureOk) return { valid: false };

    const payload = JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload))) as AccessPayload;
    if (payload.v !== 1 || typeof payload.exp !== "number") return { valid: false };
    if (payload.exp <= Date.now()) return { valid: false };
    return { valid: true, exp: payload.exp };
  } catch {
    return { valid: false };
  }
}

/** Constant-time string comparison for the access-code check (avoids timing oracle). */
export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}
