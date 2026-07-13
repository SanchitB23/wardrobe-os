import { describe, expect, it } from "vitest";

import {
  CANONICAL_SLOT_TERMS,
  OUTFIT_SLOT_DEFINITIONS,
  categoryMatchesOutfitSlot,
  resolveOutfitSlot,
} from "@/domain/outfit";

describe("resolveOutfitSlot", () => {
  it("resolves every canonical dictionary term exactly", () => {
    for (const [term, slot] of Object.entries(CANONICAL_SLOT_TERMS)) {
      expect(resolveOutfitSlot(term), term).toEqual({ slot, source: "exact" });
    }
  });

  it("folds plurals onto singular dictionary terms", () => {
    expect(resolveOutfitSlot("Chinos").slot).toBe("bottom");
    expect(resolveOutfitSlot("Joggers").slot).toBe("bottom");
    expect(resolveOutfitSlot("Polos").slot).toBe("top");
    expect(resolveOutfitSlot("Henleys").slot).toBe("top");
    expect(resolveOutfitSlot("Loafers").slot).toBe("footwear");
    expect(resolveOutfitSlot("Chelsea Boots").slot).toBe("footwear");
    expect(resolveOutfitSlot("Derbies").slot).toBe("footwear");
    expect(resolveOutfitSlot("Cardigans").slot).toBe("outerwear");
    expect(resolveOutfitSlot("Watches").slot).toBe("watch");
  });

  it("prefers bigrams over unigrams for disambiguation", () => {
    expect(resolveOutfitSlot("Oxford Shirt").slot).toBe("top");
    expect(resolveOutfitSlot("Oxfords").slot).toBe("footwear");
    expect(resolveOutfitSlot("Tank Top").slot).toBe("top");
    expect(resolveOutfitSlot("Denim Jacket").slot).toBe("outerwear");
    expect(resolveOutfitSlot("Boot Cut Jeans").slot).toBe("bottom");
  });

  it("lets the exact dictionary beat keyword substrings", () => {
    // keyword tier would say top (contains "shirt") / top (contains "top")
    expect(resolveOutfitSlot("Overshirt")).toEqual({ slot: "outerwear", source: "exact" });
    expect(resolveOutfitSlot("Laptop Bag")).toEqual({ slot: "accessory", source: "exact" });
  });

  it("resolves parts in priority order (category before name)", () => {
    expect(resolveOutfitSlot("Chinos", null, "Chelsea Boots print").slot).toBe("bottom");
    expect(resolveOutfitSlot(null, null, "White Oxford Shirt").slot).toBe("top");
  });

  it("keeps the keyword tier as a safety net", () => {
    expect(resolveOutfitSlot("Fancy Pantaloons")).toEqual({ slot: "bottom", source: "keyword" });
  });

  it("falls back to accessory with fallback provenance", () => {
    expect(resolveOutfitSlot("Mystery Object")).toEqual({ slot: "accessory", source: "fallback" });
    expect(resolveOutfitSlot(null, undefined, "")).toEqual({ slot: "accessory", source: "fallback" });
  });

  it("converges the previously disagreeing terms", () => {
    expect(resolveOutfitSlot("Hoodie").slot).toBe("top");
    expect(resolveOutfitSlot("Vest").slot).toBe("outerwear");
    expect(resolveOutfitSlot("Waistcoat").slot).toBe("outerwear");
    expect(resolveOutfitSlot("Cardigan").slot).toBe("outerwear");
    expect(resolveOutfitSlot("Kurta").slot).toBe("top");
  });
});

describe("categoryMatchesOutfitSlot (resolver-backed)", () => {
  it("matches a resolvable category on exactly one slot", () => {
    const slots = OUTFIT_SLOT_DEFINITIONS.map((d) => d.slot);
    const matched = slots.filter((slot) => categoryMatchesOutfitSlot("Chinos", slot));
    expect(matched).toEqual(["bottom"]);
  });

  it("matches dictionary-only categories that keywords used to miss", () => {
    expect(categoryMatchesOutfitSlot("Sweatpants", "bottom")).toBe(true);
    expect(categoryMatchesOutfitSlot("Cargos", "bottom")).toBe(true);
    expect(categoryMatchesOutfitSlot("Turtlenecks", "top")).toBe(true);
    expect(categoryMatchesOutfitSlot("Sandals", "footwear")).toBe(true);
    expect(categoryMatchesOutfitSlot("Slides", "footwear")).toBe(true);
  });

  it("matches nothing for unknown categories (fallback is not a match)", () => {
    for (const definition of OUTFIT_SLOT_DEFINITIONS) {
      expect(categoryMatchesOutfitSlot("Mystery Object", definition.slot)).toBe(false);
    }
    expect(categoryMatchesOutfitSlot(null, "top")).toBe(false);
  });
});
