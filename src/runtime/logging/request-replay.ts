/**
 * Request Replay capture (developer utility) — process-local only.
 *
 * Captures sanitized API completion metadata when `REPLAY_CAPTURE=true` in
 * development. Never stores bodies, prompts, or secrets. No production
 * persistence.
 */

export interface ReplayCapture {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  errorCode: string | null;
  capturedAt: string;
}

const MAX_CAPTURES = 50;

class ReplayStore {
  private readonly items: ReplayCapture[] = [];

  enabled(): boolean {
    if (process.env.NODE_ENV === "production") return false;
    const raw = (process.env.REPLAY_CAPTURE ?? "").toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
  }

  capture(entry: Omit<ReplayCapture, "capturedAt"> & { capturedAt?: string }): void {
    if (!this.enabled()) return;
    this.items.unshift({
      ...entry,
      capturedAt: entry.capturedAt ?? new Date().toISOString(),
    });
    if (this.items.length > MAX_CAPTURES) {
      this.items.length = MAX_CAPTURES;
    }
  }

  list(): ReplayCapture[] {
    return [...this.items];
  }

  get(requestId: string): ReplayCapture | null {
    return this.items.find((i) => i.requestId === requestId) ?? null;
  }

  clear(): void {
    this.items.length = 0;
  }
}

/** Shared process-local replay capture sink. */
export const replayStore = new ReplayStore();
