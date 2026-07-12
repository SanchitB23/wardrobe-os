/**
 * RequestContext (RFC-022) — AsyncLocalStorage scope for requestId / route.
 *
 * Propagates correlation into AI runtime, orchestrator, and service log lines
 * without threading an explicit id through every call.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  route?: string;
  method?: string;
  startedAtMs: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string | null {
  return storage.getStore()?.requestId ?? null;
}

export function getRequestRoute(): string | null {
  return storage.getStore()?.route ?? null;
}
