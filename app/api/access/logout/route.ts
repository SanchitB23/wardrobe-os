/**
 * POST /api/access/logout (RFC-010) — clear the access session cookie ("Lock
 * app"). Excluded from the access proxy so it is always reachable.
 */

import { NextResponse } from "next/server";

import { ACCESS_COOKIE } from "@/lib/access/session";
import { withApiLogging } from "@/runtime/logging/api-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleLogout(request: Request): Promise<Response> {
  void request;
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export const POST = withApiLogging("/api/access/logout", handleLogout);
