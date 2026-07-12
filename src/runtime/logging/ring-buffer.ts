/**
 * In-memory ring buffer of recent structured log records (RFC-022 stretch).
 *
 * Process-local and ephemeral — useful in `next dev` / single-instance preview.
 * Not a substitute for Vercel Runtime Logs on serverless multi-instance.
 */

import type { StructuredLogRecord } from "@/runtime/logging/log-types";

const DEFAULT_CAPACITY = 200;

export class LogRingBuffer {
  private readonly capacity: number;
  private readonly items: StructuredLogRecord[] = [];

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = Math.max(1, capacity);
  }

  push(record: StructuredLogRecord): void {
    this.items.push(record);
    if (this.items.length > this.capacity) {
      this.items.splice(0, this.items.length - this.capacity);
    }
  }

  /** Newest-last snapshot (oldest → newest). */
  snapshot(): StructuredLogRecord[] {
    return this.items.slice();
  }

  /** Newest-first, optionally filtered by kind / level. */
  recent(options?: {
    limit?: number;
    kind?: StructuredLogRecord["kind"];
    level?: StructuredLogRecord["level"];
  }): StructuredLogRecord[] {
    let list = this.items.slice().reverse();
    if (options?.kind) list = list.filter((r) => r.kind === options.kind);
    if (options?.level) list = list.filter((r) => r.level === options.level);
    const limit = options?.limit ?? 100;
    return list.slice(0, limit);
  }

  clear(): void {
    this.items.length = 0;
  }

  size(): number {
    return this.items.length;
  }
}

/** Shared process-local buffer for Developer Observability. */
export const logRingBuffer = new LogRingBuffer(200);
