/**
 * ItemPairingEngine (RFC-030) — deterministic item-anchored pairing.
 *
 * Pure TypeScript: no React, no Supabase, no AI, no I/O. Given an owned anchor
 * item and the active wardrobe, ranks complementary items per core outfit slot
 * and the best complete outfits built around the anchor. Adapted from the Buy
 * vs Skip engine's `scoreOutfitCompatibility` (RFC-001), re-anchored on an
 * owned item. Identical inputs always produce identical output.
 *
 * AI never produces any value here — it may only narrate the report afterwards
 * (ADR-005). See docs/rfc/RFC-030-Item-Pairing-Recommendations.md.
 */

import type { StyleDNA, StyleDNAItem } from "@/domain/style-dna";
import {
  evaluateOutfit,
  type OutfitAnalysis,
  type OutfitEngineItem,
} from "@/domain/outfit";
import type { OutfitSlot } from "@/types/wardrobe";
import {
  ITEM_PAIRING_ENGINE_VERSION,
  PAIRING_DEFAULTS,
} from "@/domain/pairing/assumptions";

const CORE_SLOTS: OutfitSlot[] = ["top", "bottom", "footwear"];

/** Fixed timestamp injected into evaluateOutfit so reports stay deterministic. */
const PAIRING_EVALUATION_AT = "1970-01-01T00:00:00.000Z";

export interface ItemPairingConfig {
  topKPerSlot: number;
  maxCandidates: number;
  maxReturnedOutfits: number;
  maxReturnedPairingsPerSlot: number;
  strongOutfitThreshold: number;
}

export type PairingExplainabilityCode =
  | "PAIRING_STRONG"
  | "PAIRING_WEAK"
  | "SLOT_EMPTY"
  | "ANCHOR_INACTIVE";

export interface PairingCandidate {
  itemId: string;
  itemName: string;
  slot: OutfitSlot;
  /** 0–10 — the best anchored-outfit score this item participates in. */
  score: number;
  /** Human-readable reasons from the best outfit's analysis breakdown. */
  reasons: string[];
}

export interface AnchoredOutfit {
  /** Complementary item ids (anchor excluded, mirroring PotentialOutfit). */
  itemIds: string[];
  /** Anchor first, then complements. */
  itemNames: string[];
  /** 0–10 outfit score from the OutfitEngine, 1 decimal. */
  score: number;
}

export interface ItemPairingReport {
  version: string;
  anchorItemId: string;
  anchorSlot: OutfitSlot;
  /** Complementary core slots only; every needed slot has a key. */
  pairingsBySlot: Partial<Record<OutfitSlot, PairingCandidate[]>>;
  /** Top anchored outfits, score-desc with deterministic ties. */
  outfits: AnchoredOutfit[];
  codes: PairingExplainabilityCode[];
}

export interface PairingEntry {
  item: StyleDNAItem;
  dna: StyleDNA;
}

export interface PairingAnchor extends PairingEntry {
  /** Archived/retired anchors do not compute pairings (ANCHOR_INACTIVE). */
  active?: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function toEngineItem(entry: PairingEntry): OutfitEngineItem {
  return {
    slot: entry.dna.slot,
    name: entry.item.name,
    formality: entry.item.formality ?? null,
    colorHex: null,
    colorName: entry.item.color ?? null,
    seasonTags: entry.item.seasons ?? [],
    occasionTags: entry.item.tags ?? [],
    material: entry.item.material ?? null,
    rating: entry.item.rating ?? null,
  };
}

/** Reasons surfaced per pairing: colour/formality/texture rule results. */
function breakdownReasons(analysis: OutfitAnalysis): string[] {
  return [
    analysis.breakdown.color.reason,
    analysis.breakdown.formality.reason,
    analysis.breakdown.texture.reason,
  ].filter((reason) => reason.trim().length > 0);
}

interface ScoredCandidate {
  entries: PairingEntry[];
  analysis: OutfitAnalysis;
  score: number;
}

function emptyReport(
  anchor: PairingAnchor,
  codes: PairingExplainabilityCode[],
  neededSlots: OutfitSlot[],
): ItemPairingReport {
  const pairingsBySlot: Partial<Record<OutfitSlot, PairingCandidate[]>> = {};
  for (const slot of neededSlots) pairingsBySlot[slot] = [];
  return {
    version: ITEM_PAIRING_ENGINE_VERSION,
    anchorItemId: anchor.item.id,
    anchorSlot: anchor.dna.slot,
    pairingsBySlot,
    outfits: [],
    codes,
  };
}

/**
 * Build the deterministic pairing report for an owned anchor item.
 *
 * Algorithm (RFC-030 §6): top-K wardrobe items per complementary core slot →
 * bounded cartesian product of anchored outfit candidates → each scored with
 * `evaluateOutfit` → per-item pairing score = best participating outfit score,
 * so pairings and outfits can never contradict each other.
 */
export function buildPairingReport(
  anchor: PairingAnchor,
  wardrobe: ReadonlyArray<PairingEntry>,
  config?: Partial<ItemPairingConfig>,
): ItemPairingReport {
  const cfg: ItemPairingConfig = { ...PAIRING_DEFAULTS, ...config };
  const neededSlots = CORE_SLOTS.filter((slot) => slot !== anchor.dna.slot);

  if (anchor.active === false) {
    return emptyReport(anchor, ["ANCHOR_INACTIVE"], neededSlots);
  }

  const bySlot = new Map<OutfitSlot, PairingEntry[]>();
  for (const entry of wardrobe) {
    if (entry.item.id === anchor.item.id) continue;
    const list = bySlot.get(entry.dna.slot) ?? [];
    list.push(entry);
    bySlot.set(entry.dna.slot, list);
  }

  const topK = (slot: OutfitSlot) =>
    (bySlot.get(slot) ?? [])
      .slice()
      .sort(
        (a, b) =>
          (b.item.rating ?? 0) - (a.item.rating ?? 0) ||
          a.item.name.localeCompare(b.item.name),
      )
      .slice(0, cfg.topKPerSlot);

  const slotOptions = neededSlots.map(topK);

  // A missing core slot means no complete outfit exists — never fabricate one.
  if (slotOptions.some((options) => options.length === 0)) {
    return emptyReport(anchor, ["SLOT_EMPTY"], neededSlots);
  }

  const anchorEngineItem = toEngineItem(anchor);
  const candidates: ScoredCandidate[] = [];
  // Deterministic bounded cartesian product across needed slots.
  const build = (index: number, chosen: PairingEntry[]) => {
    if (candidates.length >= cfg.maxCandidates) return;
    if (index === slotOptions.length) {
      const analysis = evaluateOutfit(
        { items: [anchorEngineItem, ...chosen.map(toEngineItem)] },
        { generatedAt: PAIRING_EVALUATION_AT },
      );
      candidates.push({
        entries: chosen.slice(),
        analysis,
        score: round1(analysis.overallScore),
      });
      return;
    }
    for (const option of slotOptions[index]) {
      build(index + 1, [...chosen, option]);
      if (candidates.length >= cfg.maxCandidates) return;
    }
  };
  build(0, []);

  const ranked = candidates
    .slice()
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entries
          .map((e) => e.item.name)
          .join("|")
          .localeCompare(b.entries.map((e) => e.item.name).join("|")),
    );

  const outfits: AnchoredOutfit[] = ranked
    .slice(0, cfg.maxReturnedOutfits)
    .map((candidate) => ({
      itemIds: candidate.entries.map((e) => e.item.id),
      itemNames: [anchor.item.name, ...candidate.entries.map((e) => e.item.name)],
      score: candidate.score,
    }));

  // Per-item pairing score = best candidate outfit the item appears in.
  const bestBy = new Map<string, ScoredCandidate>();
  for (const candidate of ranked) {
    for (const entry of candidate.entries) {
      if (!bestBy.has(entry.item.id)) bestBy.set(entry.item.id, candidate);
    }
  }

  const pairingsBySlot: Partial<Record<OutfitSlot, PairingCandidate[]>> = {};
  for (let i = 0; i < neededSlots.length; i++) {
    const slot = neededSlots[i];
    pairingsBySlot[slot] = slotOptions[i]
      .map((entry) => {
        const best = bestBy.get(entry.item.id);
        if (!best) return null;
        return {
          itemId: entry.item.id,
          itemName: entry.item.name,
          slot,
          score: best.score,
          reasons: breakdownReasons(best.analysis),
        };
      })
      .filter((p): p is PairingCandidate => p !== null)
      .sort((a, b) => b.score - a.score || a.itemName.localeCompare(b.itemName))
      .slice(0, cfg.maxReturnedPairingsPerSlot);
  }

  const bestScore = ranked[0]?.score ?? 0;
  const codes: PairingExplainabilityCode[] = [
    bestScore >= cfg.strongOutfitThreshold ? "PAIRING_STRONG" : "PAIRING_WEAK",
  ];

  return {
    version: ITEM_PAIRING_ENGINE_VERSION,
    anchorItemId: anchor.item.id,
    anchorSlot: anchor.dna.slot,
    pairingsBySlot,
    outfits,
    codes,
  };
}
