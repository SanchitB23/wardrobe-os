/**
 * POST /api/access/logout (RFC-010) — clear the access session cookie ("Lock
 * app"). Excluded from the access proxy so it is always reachable.
 */

import { NextResponse } from "next/server";

import { ACCESS_COOKIE } from "@/lib/access/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
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
