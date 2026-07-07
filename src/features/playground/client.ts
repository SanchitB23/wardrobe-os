/**
 * Client caller for the playground API. Server-only code never leaks here.
 */

import type {
  PlaygroundRunRequest,
  PlaygroundRunResult,
} from "@/features/playground/types";

export async function runPlaygroundRequest(
  request: PlaygroundRunRequest,
  signal?: AbortSignal,
): Promise<PlaygroundRunResult> {
  const response = await fetch("/api/ai/playground", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | PlaygroundRunResult
    | { error?: string }
    | null;

  if (!response.ok || !payload) {
    const message =
      (payload && "error" in payload && payload.error) || "Playground request failed.";
    throw new Error(message);
  }
  return payload as PlaygroundRunResult;
}
