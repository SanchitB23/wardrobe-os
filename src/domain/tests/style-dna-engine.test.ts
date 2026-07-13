import { describe, expect, it } from "vitest";

import {
  createStyleDNAEngine,
  deriveStyleDNA,
  styleDNAEngine,
  type StyleDNAItem,
} from "@/domain/style-dna";

function item(overrides: Partial<StyleDNAItem> = {}): StyleDNAItem {
  return {
    id: "i1",
    name: "Item",
    category: "Top",
    subcategory: null,
    color: "Navy",
    brand: null,
    formality: "smart_casual",
    usage: "regular",
    rating: 8,
    seasons: ["Year Round"],
    styles: ["Smart Casual"],
    tags: ["Casual"],
    ...overrides,
  };
}

describe("deriveStyleDNA", () => {
  it("produces a complete profile for any item", () => {
    const dna = deriveStyleDNA(item());
    expect(dna.itemId).toBe("i1");
    expect(dna.slot).toBe("top");
    expect(dna.formality).toBe("smart_casual");
    expect(dna.primaryStyle).toBe("Smart Casual");
    expect(dna.color).toBeDefined();
    expect(dna.texture).toBeDefined();
    expect(dna.weather).toBeDefined();
    expect(dna.occasion).toBeDefined();
    expect(dna.style).toBeDefined();
    expect(dna.compatibility).toBeDefined();
  });

  it("analyzes a bare item without crashing (every item analyzable)", () => {
    const dna = deriveStyleDNA({ id: "x", name: "Mystery", category: null });
    expect(dna.slot).toBe("accessory"); // unmapped → accessory fallback
    expect(dna.color.family).toBeNull();
    expect(dna.occasion.best).toBeTruthy();
  });

  describe("slot resolution", () => {
    it("maps common bottom categories to the bottom slot", () => {
      expect(deriveStyleDNA(item({ category: "Chinos", subcategory: null })).slot).toBe("bottom");
      expect(deriveStyleDNA(item({ category: "Joggers", subcategory: null })).slot).toBe("bottom");
      expect(deriveStyleDNA(item({ category: "Leggings", subcategory: null })).slot).toBe("bottom");
    });

    it("maps Polos to the top slot", () => {
      expect(deriveStyleDNA(item({ category: "Polos", subcategory: null })).slot).toBe("top");
    });

    it("maps common footwear categories to the footwear slot", () => {
      expect(deriveStyleDNA(item({ category: "Chelsea Boots", subcategory: null })).slot).toBe("footwear");
      expect(deriveStyleDNA(item({ category: "Loafers", subcategory: null })).slot).toBe("footwear");
    });

    it("exposes slot resolution provenance", () => {
      expect(deriveStyleDNA(item({ category: "Chinos", subcategory: null })).slotSource).toBe("exact");
      expect(deriveStyleDNA({ id: "x", name: "Mystery", category: null }).slotSource).toBe("fallback");
    });

    it("falls back to the item name when category is missing", () => {
      const dna = deriveStyleDNA({ id: "n1", name: "White Oxford Shirt", category: null });
      expect(dna.slot).toBe("top");
      expect(dna.slotSource).toBe("exact");
    });
  });

  describe("colour profile", () => {
    it("classifies temperature, neutrality, contrast, and boldness", () => {
      expect(deriveStyleDNA(item({ color: "Navy" })).color).toMatchObject({
        family: "navy",
        temperature: "cool",
        neutral: true,
      });
      const white = deriveStyleDNA(item({ color: "White" })).color;
      expect(white.temperature).toBe("neutral");
      expect(white.contrast).toBeGreaterThanOrEqual(8); // near-white reads high contrast
      const red = deriveStyleDNA(item({ color: "Red" })).color;
      expect(red.temperature).toBe("warm");
      expect(red.boldness).toBeGreaterThanOrEqual(7);
      expect(red.neutral).toBe(false);
    });
  });

  describe("texture profile", () => {
    it("infers texture, weight, and care from material/name", () => {
      const denim = deriveStyleDNA(item({ name: "Blue Jeans", category: "Bottom", subcategory: "Jeans" })).texture;
      expect(denim.texture).toBe("denim");

      const wool = deriveStyleDNA(item({ name: "Wool Sweater", category: "Top", material: "Wool" })).texture;
      expect(wool.texture).toBe("knit");
      expect(wool.fabricWeight).toBe("heavy");
      expect(wool.careComplexity).toBe("delicate");

      const linen = deriveStyleDNA(item({ name: "Linen Shirt", material: "Linen" })).texture;
      expect(linen.fabricWeight).toBe("light");
    });
  });

  describe("weather profile", () => {
    it("favors summer for light fabrics and winter for heavy ones", () => {
      const tee = deriveStyleDNA(item({ name: "Cotton Tee", subcategory: "T-Shirt", seasons: ["Summer"] })).weather;
      expect(tee.suitability.summer).toBeGreaterThan(tee.suitability.winter);

      const coat = deriveStyleDNA(item({ name: "Wool Overcoat", category: "Outerwear", seasons: ["Winter"], material: "Wool" })).weather;
      expect(coat.suitability.winter).toBeGreaterThan(coat.suitability.summer);
      expect(coat.minTempC).toBeLessThan(tee.minTempC);
    });
  });

  describe("occasion suitability", () => {
    it("rates activewear high for gym and unsuitable for office/wedding", () => {
      const active = deriveStyleDNA(
        item({ name: "Performance Tee", subcategory: "T-Shirt", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
      ).occasion.suitability;
      expect(active.gym).toBeGreaterThanOrEqual(8);
      expect(active.office).toBe(0);
      expect(active.wedding).toBe(0);
    });

    it("rates formalwear high for weddings and unsuitable for gym", () => {
      const formal = deriveStyleDNA(
        item({ name: "Formal Shirt", subcategory: "Shirt", formality: "business_formal", tags: ["Wedding"], styles: ["Formal"] }),
      ).occasion.suitability;
      expect(formal.wedding).toBeGreaterThanOrEqual(8);
      expect(formal.gym).toBe(0);
    });

    it("rates office staples high for office and unsuitable for gym", () => {
      const polo = deriveStyleDNA(
        item({ name: "Navy Polo", subcategory: "Polo", formality: "smart_casual", tags: ["Office"] }),
      ).occasion.suitability;
      expect(polo.office).toBeGreaterThanOrEqual(8);
      expect(polo.gym).toBe(0);

      const chino = deriveStyleDNA(
        item({ name: "Charcoal Chinos", category: "Bottom", subcategory: "Chinos", formality: "smart_casual" }),
      ).occasion.suitability;
      expect(chino.office).toBeGreaterThanOrEqual(8);
      expect(chino.gym).toBe(0);
    });
  });

  describe("style + compatibility", () => {
    it("scores professionalism high for business, low for athleisure", () => {
      const business = deriveStyleDNA(item({ formality: "business_formal", tags: ["Office"], styles: ["Classic"] })).style;
      const athleisure = deriveStyleDNA(item({ formality: "casual", tags: ["Gym"], styles: ["Athleisure"] })).style;
      expect(business.professionalism).toBeGreaterThan(athleisure.professionalism);
    });

    it("rates neutral smart-casual pieces as versatile", () => {
      const versatile = deriveStyleDNA(item({ color: "Navy", formality: "smart_casual" })).compatibility.versatility;
      const loud = deriveStyleDNA(item({ color: "Orange", formality: "formal", styles: ["Statement"] })).compatibility;
      expect(versatile).toBeGreaterThan(4);
      expect(loud.visualBoldness).toBeGreaterThan(5);
    });

    it("rates easy-care sneakers as travel-friendly and dress shoes less so", () => {
      const sneaker = deriveStyleDNA(item({ name: "Canvas Sneakers", category: "Footwear", subcategory: "Sneakers", color: "Navy", material: "Canvas" })).compatibility;
      const dress = deriveStyleDNA(item({ name: "Leather Oxfords", category: "Footwear", subcategory: "Oxford", color: "Black", material: "Leather", formality: "formal" })).compatibility;
      expect(sneaker.travelFriendliness).toBeGreaterThan(dress.travelFriendliness);
    });
  });

  it("is deterministic", () => {
    const input = item({ name: "Repeatable" });
    expect(deriveStyleDNA(input)).toEqual(deriveStyleDNA(input));
  });
});

describe("StyleDNAEngine", () => {
  it("analyze and analyzeAll match deriveStyleDNA", () => {
    const items = [item({ id: "a" }), item({ id: "b", category: "Bottom" })];
    expect(styleDNAEngine.analyze(items[0])).toEqual(deriveStyleDNA(items[0]));
    expect(styleDNAEngine.analyzeAll(items)).toEqual(items.map(deriveStyleDNA));
  });

  it("createStyleDNAEngine returns a working engine", () => {
    const engine = createStyleDNAEngine();
    expect(engine.analyze(item()).slot).toBe("top");
  });
});
