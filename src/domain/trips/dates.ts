/**
 * Trip date helpers (RFC-017) — pure, deterministic UTC date arithmetic used by
 * template expansion and cloning. No I/O, no wall-clock. Mirrors the UTC parsing
 * used by the Lifestyle Engine's `eachDateInclusive`.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse an ISO date (YYYY-MM-DD) as a UTC epoch (NaN if invalid). */
export function parseUtc(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

/** Add `days` (may be negative) to an ISO date, returning an ISO date. */
export function addDays(date: string, days: number): string {
  const t = parseUtc(date);
  if (Number.isNaN(t)) return date;
  return new Date(t + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from `a` → `b` (b − a). Negative if b precedes a; 0 if invalid. */
export function daysBetween(a: string, b: string): number {
  const ta = parseUtc(a);
  const tb = parseUtc(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.round((tb - ta) / MS_PER_DAY);
}

/** Inclusive trip length in days (>= 1 for a valid same-day trip; 0 if invalid). */
export function durationDays(startDate: string, endDate: string): number {
  const s = parseUtc(startDate);
  const e = parseUtc(endDate);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / MS_PER_DAY) + 1;
}
