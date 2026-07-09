/**
 * Application Access Guard (RFC-010) — Next.js Proxy (formerly "middleware").
 *
 * Gates the entire app behind a single shared access code (NOT authentication).
 * A valid, unexpired, HMAC-signed cookie ⇒ allow. Otherwise: pages redirect to
 * /unlock; API routes get 401.
 *
 * Enabled only when APP_ACCESS_CODE is set (so local dev is frictionless).
 * Fail-closed if the code is set but APP_COOKIE_SECRET is missing.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCESS_COOKIE, verifySession } from "@/lib/access/session";

export const config = {
  // Run on everything EXCEPT: Next internals, the favicon, the unlock page, the
  // access endpoints (must be reachable while locked), and static asset files.
  // Everything else — all pages, /api/*, /developer, /ai/* — is guarded.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|unlock|api/access|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|txt|xml|woff|woff2|ttf|otf|map)$).*)",
  ],
};

export async function proxy(request: NextRequest) {
  const accessCode = process.env.APP_ACCESS_CODE;

  // Guard disabled when no code is configured (local development).
  if (!accessCode) return NextResponse.next();

  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const secret = process.env.APP_COOKIE_SECRET;

  // Misconfiguration: a code is set but there's no signing secret. Fail closed —
  // do not silently allow, but don't loop the unlock page either.
  if (!secret) {
    const message = "Access guard misconfigured: APP_COOKIE_SECRET is not set.";
    return isApi
      ? NextResponse.json({ error: "access_guard_misconfigured" }, { status: 503 })
      : new NextResponse(message, { status: 503, headers: { "content-type": "text/plain" } });
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const result = await verifySession(token, secret);
  if (result.valid) return NextResponse.next();

  // Locked: API → 401 (clean status for clients); page → redirect to /unlock.
  if (isApi) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }

  const unlockUrl = new URL("/unlock", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next && next !== "/") unlockUrl.searchParams.set("next", next);
  return NextResponse.redirect(unlockUrl);
}
