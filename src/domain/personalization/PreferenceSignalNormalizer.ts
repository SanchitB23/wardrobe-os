/**
 * Pure signal normalizer (RFC-004): maps raw behavioural records (wears, saved
 * outfits, favourites, purchases, plus future captured feedback/edits) into the
 * uniform {@link PreferenceSignal}[] the engine consumes. Deterministic — no I/O,
 * no time reads; timestamp-less events use an injected `defaultTimestamp`.
 *
 * "Vision observes, domain interprets": this turns behaviour into evidence, it
 * makes no decision.
 */

import { colorFamilyFor } from "@/domain/analytics/WardrobeHealthEngine";
import type {
  PreferenceDimension,
  PreferenceSignal,
} from "@/domain/personalization/types";

/** A wardrobe item, normalized enough to extract preference facets from. */
export interface ItemFacetSource {
  id: string;
  color?: string | null;
  colorFamily?: string | null;
  brand?: string | null;
  formality?: string | null;
  fit?: string | null;
  category?: string | null;
  subcategory?: string | null;
  slot?: string | null;
  styles?: string[];
  seasons?: string[];
  favorite?: boolean;
  /** ISO timestamp used for the (timestamp-less) favourite signal, if known. */
  updatedAt?: string | null;
}

export interface WearEventSource {
  itemId: string;
  wornOn: string; // ISO date/instant
  occasion?: string | null;
}

export interface SavedOutfitSource {
  itemIds: string[];
  favorite?: boolean;
  createdAt?: string | null;
}

export interface PurchaseSource {
  itemId: string;
  purchaseDate?: string | null;
}

export interface PersonalizationSourceData {
  items: ItemFacetSource[];
  wearEvents?: WearEventSource[];
  savedOutfits?: SavedOutfitSource[];
  purchases?: PurchaseSource[];
  /** Pre-built signals from future capture (feedback/edits/acquisition). */
  extraSignals?: PreferenceSignal[];
}

function isFootwear(item: ItemFacetSource): boolean {
  if (item.slot) return item.slot.toLowerCase() === "footwear";
  const hay = `${item.category ?? ""} ${item.subcategory ?? ""}`.toLowerCase();
  return /shoe|sneaker|boot|loafer|sandal|footwear|trainer/.test(hay);
}

/** Extract the preference facets an item contributes to. Deterministic. */
export function itemFacets(item: ItemFacetSource): { dimension: PreferenceDimension; value: string }[] {
  const facets: { dimension: PreferenceDimension; value: string }[] = [];
  const push = (dimension: PreferenceDimension, value: string | null | undefined) => {
    const v = value?.trim();
    if (v) facets.push({ dimension, value: v });
  };

  const family = item.colorFamily ?? colorFamilyFor(item.color ?? null);
  push("color", family);
  push("brand", item.brand);
  push("formality", item.formality);
  item.styles?.forEach((s) => push("style", s));
  item.seasons?.forEach((s) => push("season", s));
  if (isFootwear(item)) push("footwear", item.subcategory ?? item.category);
  push("silhouette", item.fit);

  return facets;
}

/**
 * Normalize raw behaviour into `PreferenceSignal[]`. `defaultTimestamp` (ISO)
 * stands in for events that carry no timestamp (e.g. a favourite flag).
 */
export function deriveSignals(
  data: PersonalizationSourceData,
  defaultTimestamp: string,
): PreferenceSignal[] {
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  const signals: PreferenceSignal[] = [];

  // Wears — the strongest revealed-preference signal.
  for (const wear of data.wearEvents ?? []) {
    const item = itemById.get(wear.itemId);
    if (!item) continue;
    const facets = itemFacets(item);
    if (wear.occasion?.trim()) facets.push({ dimension: "occasion", value: wear.occasion.trim() });
    if (facets.length === 0) continue;
    signals.push({ type: "wear", facets, polarity: 1, occurredAt: wear.wornOn, subjectId: item.id });
  }

  // Favourited items.
  for (const item of data.items) {
    if (!item.favorite) continue;
    const facets = itemFacets(item);
    if (facets.length === 0) continue;
    signals.push({
      type: "favorite",
      facets,
      polarity: 1,
      occurredAt: item.updatedAt ?? defaultTimestamp,
      subjectId: item.id,
    });
  }

  // Saved / favourited outfits — curated combinations.
  for (const outfit of data.savedOutfits ?? []) {
    if (outfit.favorite === false) continue;
    const facets: { dimension: PreferenceDimension; value: string }[] = [];
    const seen = new Set<string>();
    for (const id of outfit.itemIds) {
      const item = itemById.get(id);
      if (!item) continue;
      for (const facet of itemFacets(item)) {
        const key = `${facet.dimension}:${facet.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        facets.push(facet);
      }
    }
    if (facets.length === 0) continue;
    signals.push({
      type: "outfit_saved",
      facets,
      polarity: 1,
      occurredAt: outfit.createdAt ?? defaultTimestamp,
    });
  }

  // Purchases — intent, not yet proven by wear.
  for (const purchase of data.purchases ?? []) {
    const item = itemById.get(purchase.itemId);
    if (!item) continue;
    const facets = itemFacets(item);
    if (facets.length === 0) continue;
    signals.push({
      type: "purchase",
      facets,
      polarity: 1,
      occurredAt: purchase.purchaseDate ?? defaultTimestamp,
      subjectId: item.id,
    });
  }

  // Future-captured signals (feedback/edits/acquisition) pass through as-is.
  if (data.extraSignals?.length) signals.push(...data.extraSignals);

  return signals;
}
