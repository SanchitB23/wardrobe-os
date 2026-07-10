/**
 * Intelligence Center (RFC-015) — dedupe + deterministic ranking.
 *
 * Collapses actions that target the same subject with the same type (keeping the
 * strongest impact, merging sources + reason codes), then ranks by impact →
 * priority → stable id. Pure; no I/O.
 */

import type { ActionCard, ActionPriority, ActionSubject } from "@/domain/intelligence/ActionTypes";

const PRIORITY_RANK: Record<ActionPriority, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Stable dedup key: an action is "the same" if type + subject match. */
export function subjectKey(type: string, subject: ActionSubject): string {
  return `${type}:${subject.kind}:${subject.id ?? slug(subject.label)}`;
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/** Merge cards that share a (type, subject); keep the strongest, union metadata. */
export function dedupe(cards: ActionCard[]): ActionCard[] {
  const byKey = new Map<string, ActionCard>();
  for (const card of cards) {
    const key = subjectKey(card.type, card.subject);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...card, sources: [...card.sources], reasonCodes: [...card.reasonCodes] });
      continue;
    }
    // Keep the higher-impact card as the base; merge the other's provenance.
    const [base, other] = existing.impact >= card.impact ? [existing, card] : [card, existing];
    byKey.set(key, {
      ...base,
      sources: uniq([...base.sources, ...other.sources]),
      reasonCodes: uniq([...base.reasonCodes, ...other.reasonCodes]),
      debug: { ...base.debug, dedupedFrom: existing.debug.dedupedFrom + card.debug.dedupedFrom },
    });
  }
  return [...byKey.values()];
}

/** Rank by impact desc, then priority, then id — deterministic + stable. */
export function rank(cards: ActionCard[]): ActionCard[] {
  return [...cards].sort(
    (a, b) =>
      b.impact - a.impact ||
      PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
      a.id.localeCompare(b.id),
  );
}
