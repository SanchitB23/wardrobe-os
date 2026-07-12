/**
 * POST /api/access/unlock (RFC-010) — validate the shared access code and,
 * on success, issue a signed HttpOnly session cookie. Not authentication.
 *
 * Excluded from the access proxy so it is reachable while the app is locked.
 * Never logs the submitted code (RFC-022 redaction).
 */

import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  constantTimeEqual,
  signSession,
} from "@/lib/access/session";
import { withApiLogging } from "@/runtime/logging/api-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleUnlock(request: Request): Promise<Response> {
  const accessCode = process.env.APP_ACCESS_CODE;
  const secret = process.env.APP_COOKIE_SECRET;

  // If the guard isn't configured there's nothing to unlock.
  if (!accessCode || !secret) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const submitted =
    typeof (body as { code?: unknown })?.code === "string"
      ? (body as { code: string }).code
      : "";

  // Constant-time compare — no timing oracle, generic failure.
  if (!submitted || !constantTimeEqual(submitted, accessCode)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const token = await signSession(exp, secret);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export const POST = withApiLogging("/api/access/unlock", handleUnlock);
