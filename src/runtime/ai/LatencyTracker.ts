/**
 * AI Runtime v2 (RFC-014) — latency accumulator.
 *
 * A tiny running-average tracker (used by RuntimeMetrics). Ignores null samples
 * (e.g. failed calls with no measured latency). No I/O.
 */

export class LatencyTracker {
  private count = 0;
  private sum = 0;
  private last: number | null = null;

  record(latencyMs: number | null): void {
    if (latencyMs == null) return;
    this.count += 1;
    this.sum += latencyMs;
    this.last = latencyMs;
  }

  average(): number | null {
    return this.count > 0 ? Math.round(this.sum / this.count) : null;
  }

  lastMs(): number | null {
    return this.last;
  }

  reset(): void {
    this.count = 0;
    this.sum = 0;
    this.last = null;
  }
}
