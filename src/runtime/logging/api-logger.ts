/**
 * APILogger + withApiLogging (RFC-022) — wrap App Router handlers.
 *
 * One completion line per request: method, route, status, latency, requestId,
 * redacted UA / IP. Sets `x-request-id` on the response; injects `requestId`
 * into JSON error bodies when practical.
 */

import { NextResponse } from "next/server";

import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/runtime/logging/correlation-id";
import { logger } from "@/runtime/logging/logger";
import { redactIp, redactUserAgent } from "@/runtime/logging/redaction";
import {
  runWithRequestContext,
  type RequestContext,
} from "@/runtime/logging/request-context";
import { getLoggingConfig } from "@/runtime/logging/log-types";
import { replayStore } from "@/runtime/logging/request-replay";

export interface ApiRequestEventInput {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  userAgent?: string | null;
  ip?: string | null;
  errorCode?: string | null;
  level?: "info" | "warn" | "error" | "debug";
  message?: string;
}

/** Emit a structured `api_request` log line. */
export function logApiRequest(input: ApiRequestEventInput): void {
  const config = getLoggingConfig();
  const ua = redactUserAgent(input.userAgent, config.redacted);
  const ip = redactIp(input.ip, config.redacted);
  const level =
    input.level ??
    (input.statusCode >= 500 ? "error" : input.statusCode >= 400 ? "warn" : "info");

  logger.log({
    kind: "api_request",
    level,
    message: input.message ?? `${input.method} ${input.route} ${input.statusCode}`,
    source: "api",
    requestId: input.requestId,
    method: input.method,
    route: input.route,
    statusCode: input.statusCode,
    latencyMs: input.latencyMs,
    userAgent: ua,
    ip,
    errorCode: input.errorCode ?? null,
  });
}

function clientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    null
  );
}

/**
 * Attach `x-request-id` and, for JSON error responses (status ≥ 400), ensure
 * the body includes `requestId` when it is a plain object.
 */
export async function attachRequestId(
  response: Response,
  requestId: string,
): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  if (response.status < 400) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  try {
    const body = await response.clone().json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const enriched = { ...(body as Record<string, unknown>), requestId };
      return NextResponse.json(enriched, {
        status: response.status,
        headers,
      });
    }
  } catch {
    // Non-JSON or empty — fall through with header only.
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export type ApiHandler = (request: Request) => Promise<Response> | Response;

/**
 * Wrap an App Router handler with request correlation + completion logging.
 */
export function withApiLogging(route: string, handler: ApiHandler): ApiHandler {
  return async (request: Request): Promise<Response> => {
    const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
    const method = request.method;
    const startedAtMs = Date.now();
    const ctx: RequestContext = {
      requestId,
      route,
      method,
      startedAtMs,
    };
    const ua = request.headers.get("user-agent");
    const ip = clientIp(request);

    return runWithRequestContext(ctx, async () => {
      let statusCode = 500;
      let errorCode: string | null = null;
      let response: Response;

      try {
        response = await handler(request);
        statusCode = response.status;

        // Best-effort: pull a stable error code from JSON errors without
        // consuming the body for success / stream responses.
        if (statusCode >= 400) {
          const ct = response.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            try {
              const body = (await response.clone().json()) as {
                code?: unknown;
                error?: unknown;
              };
              if (typeof body.code === "string") errorCode = body.code;
              else if (typeof body.error === "string" && body.error.length < 64) {
                errorCode = body.error;
              }
            } catch {
              // ignore
            }
          }
        }

        response = await attachRequestId(response, requestId);
        return response;
      } catch (error) {
        errorCode =
          error instanceof Error && "code" in error
            ? String((error as { code?: unknown }).code ?? "unhandled")
            : "unhandled";
        const message =
          error instanceof Error ? error.message : "Internal server error.";
        response = NextResponse.json(
          { ok: false, error: message, requestId, code: errorCode },
          {
            status: 500,
            headers: { [REQUEST_ID_HEADER]: requestId },
          },
        );
        statusCode = 500;
        return response;
      } finally {
        const latencyMs = Date.now() - startedAtMs;
        logApiRequest({
          requestId,
          method,
          route,
          statusCode,
          latencyMs,
          userAgent: ua,
          ip,
          errorCode,
        });
        replayStore.capture({
          requestId,
          method,
          route,
          statusCode,
          latencyMs,
          errorCode,
        });
      }
    });
  };
}
