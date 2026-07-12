/**
 * Domain tests — Wear Logs combination fingerprinting & promotion (RFC-023).
 */

import { describe, expect, it } from "vitest";

import {
  buildCombinationKey,
  buildCombinationSuggestion,
  buildOrderedWearItems,
  legacyOutfitGroupKey,
  mapWearLogToOutfitDraft,
  normalizeItemIds,
  shouldSuggestOutfitPromotion,
} from "@/domain/wear-logs";

describe("normalizeItemIds / buildCombinationKey", () => {
  it("is order-insensitive and collapses duplicates", () => {
    const a = buildCombinationKey(["b", "a", "a"]);
    const b = buildCombinationKey(["a", "b"]);
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it("differs for different sets", () => {
    expect(buildCombinationKey(["a"])).not.toBe(buildCombinationKey(["a", "b"]));
  });

  it("rejects empty sets", () => {
    expect(() => buildCombinationKey([])).toThrow(/empty/i);
    expect(normalizeItemIds(["", "  "])).toEqual([]);
  });
});

describe("shouldSuggestOutfitPromotion", () => {
  it("requires threshold and ≥2 items", () => {
    expect(shouldSuggestOutfitPromotion(3, { itemCount: 1 })).toBe(false);
    expect(shouldSuggestOutfitPromotion(2, { itemCount: 2, threshold: 3 })).toBe(
      false,
    );
    expect(shouldSuggestOutfitPromotion(3, { itemCount: 2, threshold: 3 })).toBe(
      true,
    );
  });

  it("never suggests for already-curated outfit wears", () => {
    expect(
      shouldSuggestOutfitPromotion(10, {
        itemCount: 3,
        alreadyCurated: true,
      }),
    ).toBe(false);
  });
});

describe("buildCombinationSuggestion", () => {
  it("wires count and promote flag", () => {
    const s = buildCombinationSuggestion({
      combinationKey: "abc",
      count: 3,
      itemCount: 2,
    });
    expect(s.shouldSuggestPromote).toBe(true);
    expect(s.threshold).toBe(3);
  });

  it("suppresses promote for outfit source", () => {
    const s = buildCombinationSuggestion({
      combinationKey: "abc",
      count: 5,
      itemCount: 3,
      sourceIsOutfit: true,
    });
    expect(s.shouldSuggestPromote).toBe(false);
  });
});

describe("buildOrderedWearItems / mapWearLogToOutfitDraft", () => {
  it("assigns sort order and de-dupes", () => {
    const items = buildOrderedWearItems([
      { itemId: "t1", slot: "top" },
      { itemId: "t1", slot: "top" },
      { itemId: "b1", slot: "bottom" },
    ]);
    expect(items).toEqual([
      { itemId: "t1", slot: "top", sortOrder: 0 },
      { itemId: "b1", slot: "bottom", sortOrder: 1 },
    ]);
  });

  it("maps wear log to outfit draft preserving order", () => {
    const draft = mapWearLogToOutfitDraft({
      wornOn: "2026-07-12",
      occasionId: "occ-1",
      notes: "brunch",
      items: [
        { itemId: "b", slot: "bottom", sortOrder: 1 },
        { itemId: "a", slot: "top", sortOrder: 0 },
      ],
    });
    expect(draft.itemIds).toEqual(["a", "b"]);
    expect(draft.occasionId).toBe("occ-1");
    expect(draft.nameHint).toBeNull();
  });

  it("rejects empty promote", () => {
    expect(() =>
      mapWearLogToOutfitDraft({
        wornOn: "2026-07-12",
        occasionId: null,
        notes: null,
        items: [],
      }),
    ).toThrow(/no items/i);
  });
});

describe("legacyOutfitGroupKey", () => {
  it("groups identical outfit wears", () => {
    const a = legacyOutfitGroupKey({
      wornOn: "2026-07-01",
      outfitId: "o1",
      notes: null,
      occasionId: null,
    });
    const b = legacyOutfitGroupKey({
      wornOn: "2026-07-01",
      outfitId: "o1",
      notes: null,
      occasionId: null,
    });
    expect(a).toBe(b);
  });
});
