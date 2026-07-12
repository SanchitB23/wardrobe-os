/**
 * Status feature service (RFC-028). Thin client wrapper around the manual
 * probe route — never invoked automatically; only on "Run checks". Returns
 * `{ data, error }` to match the rest of the feature-service conventions.
 */

import type { ServiceId } from "@/domain/status";
import { toError } from "@/shared/utils/data-result";

export type ProbeResult = {
  id: ServiceId;
  ok: boolean;
  latencyMs: number;
  skipped?: boolean;
  error?: string;
};

type Result<T> = { data: T | null; error: Error | null };

export async function runStatusProbes(): Promise<Result<ProbeResult[]>> {
  try {
    const response = await fetch("/api/status/probe", { method: "POST" });
    if (!response.ok) {
      return { data: null, error: toError(`Probe failed (HTTP ${response.status})`) };
    }
    const body = (await response.json()) as { results: ProbeResult[] };
    return { data: body.results, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : toError("Probe failed"),
    };
  }
}
