/**
 * Application Access Guard (RFC-010) — Next.js Proxy (formerly "middleware").
 *
 * Gates the entire app behind a single shared access code (NOT authentication).
 * A valid, unexpired, HMAC-signed cookie ⇒ allow. Otherwise: pages redirect to
 * /unlock; API routes get 401.
 *
 * Enabled only when APP_ACCESS_CODE is set (so local dev is frictionless).
 * Fail-closed if the code is set but APP_COOKIE_SECRET is missing.
 *
 * When the guard is active, emits structured `api_request` JSON lines
 * (requestId, status, latency) — edge-safe (no Node crypto / ALS).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCESS_COOKIE, verifySession } from "@/lib/access/session";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/runtime/logging/correlation-id";

export const config = {
  // Run on everything EXCEPT: Next internals, the favicon, the unlock page, the
  // access endpoints (must be reachable while locked), and static asset files.
  // Everything else — all pages, /api/*, /developer, /ai/* — is guarded.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|unlock|api/access|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|txt|xml|woff|woff2|ttf|otf|map)$).*)",
  ],
};

function emitProxyLog(input: {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  errorCode: string | null;
}): void {
  // Edge-safe: avoid importing the Node logger / redaction modules.
  const requestsOff = (process.env.LOG_REQUESTS ?? "true").toLowerCase();
  if (requestsOff === "0" || requestsOff === "false" || requestsOff === "off") {
    return;
  }
  const line = JSON.stringify({
    kind: "api_request",
    level: input.statusCode >= 500 ? "error" : input.statusCode >= 400 ? "warn" : "info",
    message: `${input.method} ${input.route} ${input.statusCode}`,
    source: "proxy",
    requestId: input.requestId,
    timestamp: new Date().toISOString(),
    method: input.method,
    route: input.route,
    statusCode: input.statusCode,
    latencyMs: input.latencyMs,
    userAgent: null,
    ip: null,
    errorCode: input.errorCode,
  });
  if (input.statusCode >= 500) console.error(line);
  else if (input.statusCode >= 400) console.warn(line);
  else console.log(line);
}

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export async function proxy(request: NextRequest) {
  const started = Date.now();
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const method = request.method;
  const route = request.nextUrl.pathname;
  const accessCode = process.env.APP_ACCESS_CODE;

  // Guard disabled when no code is configured (local development) — no log spam.
  if (!accessCode) {
    return withRequestId(NextResponse.next(), requestId);
  }

  const isApi = route.startsWith("/api/");
  const secret = process.env.APP_COOKIE_SECRET;

  // Misconfiguration: a code is set but there's no signing secret. Fail closed —
  // do not silently allow, but don't loop the unlock page either.
  if (!secret) {
    const message = "Access guard misconfigured: APP_COOKIE_SECRET is not set.";
    const response = isApi
      ? NextResponse.json(
          { error: "access_guard_misconfigured", requestId },
          { status: 503, headers: { [REQUEST_ID_HEADER]: requestId } },
        )
      : new NextResponse(message, {
          status: 503,
          headers: { "content-type": "text/plain", [REQUEST_ID_HEADER]: requestId },
        });
    emitProxyLog({
      requestId,
      method,
      route,
      statusCode: 503,
      latencyMs: Date.now() - started,
      errorCode: "access_guard_misconfigured",
    });
    return response;
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const result = await verifySession(token, secret);
  if (result.valid) {
    const response = withRequestId(NextResponse.next(), requestId);
    emitProxyLog({
      requestId,
      method,
      route,
      statusCode: 200,
      latencyMs: Date.now() - started,
      errorCode: null,
    });
    return response;
  }

  // Locked: API → 401 (clean status for clients); page → redirect to /unlock.
  if (isApi) {
    const response = NextResponse.json(
      { error: "locked", requestId },
      { status: 401, headers: { [REQUEST_ID_HEADER]: requestId } },
    );
    emitProxyLog({
      requestId,
      method,
      route,
      statusCode: 401,
      latencyMs: Date.now() - started,
      errorCode: "locked",
    });
    return response;
  }

  const unlockUrl = new URL("/unlock", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next && next !== "/") unlockUrl.searchParams.set("next", next);
  const response = withRequestId(NextResponse.redirect(unlockUrl), requestId);
  emitProxyLog({
    requestId,
    method,
    route,
    statusCode: 307,
    latencyMs: Date.now() - started,
    errorCode: "locked",
  });
  return response;
}
