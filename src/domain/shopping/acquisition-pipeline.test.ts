/**
 * RFC-018C Acquisition-to-Inventory Pipeline — pure domain helpers.
 */

import { describe, expect, it } from "vitest";

import type { ProspectiveItem } from "@/domain/acquisition";
import {
  assertConversionAllowed,
  filterDecisionCards,
  mapProspectiveToInventoryDraft,
  matchLookupId,
  resolveDecisionActions,
  resolveDecisionLifecycle,
} from "@/domain/shopping/AcquisitionPipeline";

const item = (overrides: Partial<ProspectiveItem> = {}): ProspectiveItem => ({
  name: "Navy Blazer",
  category: "blazer",
  subcategory: "structured",
  brand: "Uniqlo",
  color: "navy",
  material: "wool",
  formality: "smart casual",
  estimatedPrice: 120,
  styleTags: ["minimal"],
  intendedOccasions: ["work"],
  notes: "From screenshot",
  ...overrides,
});

describe("mapProspectiveToInventoryDraft", () => {
  it("maps prospective fields into inventory draft", () => {
    const draft = mapProspectiveToInventoryDraft(item(), {
      imageUrl: "https://example.com/a.jpg",
      nowMs: 1_700_000_000_000,
    });
    expect(draft.name).toBe("Navy Blazer");
    expect(draft.categoryText).toBe("blazer");
    expect(draft.subcategoryText).toBe("structured");
    expect(draft.brandText).toBe("Uniqlo");
    expect(draft.colorText).toBe("navy");
    expect(draft.materialText).toBe("wool");
    expect(draft.formality).toBe("smart_casual");
    expect(draft.styleTags).toEqual(["minimal"]);
    expect(draft.occasionText).toBe("work");
    expect(draft.estimatedPrice).toBe(120);
    expect(draft.imageUrl).toBe("https://example.com/a.jpg");
    expect(draft.code).toMatch(/^acq-navy-blazer-/);
  });
});

describe("assertConversionAllowed", () => {
  it("blocks duplicate inventory conversion", () => {
    expect(
      assertConversionAllowed({
        inventoryItemId: "inv-1",
        status: "purchased",
      }),
    ).toEqual({
      ok: false,
      reason: "Already converted to inventory.",
      inventoryItemId: "inv-1",
    });
  });

  it("blocks dismissed items", () => {
    expect(
      assertConversionAllowed({ inventoryItemId: null, status: "dismissed" }),
    ).toMatchObject({ ok: false });
  });

  it("allows purchased without inventory", () => {
    expect(
      assertConversionAllowed({ inventoryItemId: null, status: "purchased" }),
    ).toEqual({ ok: true });
  });
});

describe("decision card lifecycle + actions", () => {
  it("exposes add/mark/convert when unlinked", () => {
    const ctx = {
      wishlistItemId: null,
      wishlistStatus: null,
      inventoryItemId: null,
    };
    expect(resolveDecisionLifecycle(ctx)).toBe("analyzed");
    expect(resolveDecisionActions(ctx)).toEqual([
      "add_to_wishlist",
      "mark_purchased",
      "convert_to_inventory",
    ]);
  });

  it("exposes convert when purchased on wishlist", () => {
    const ctx = {
      wishlistItemId: "wl-1",
      wishlistStatus: "purchased" as const,
      inventoryItemId: null,
    };
    expect(resolveDecisionLifecycle(ctx)).toBe("purchased");
    expect(resolveDecisionActions(ctx)).toEqual([
      "view_wishlist",
      "convert_to_inventory",
    ]);
  });

  it("exposes view inventory when converted", () => {
    const ctx = {
      wishlistItemId: "wl-1",
      wishlistStatus: "purchased" as const,
      inventoryItemId: "inv-1",
    };
    expect(resolveDecisionLifecycle(ctx)).toBe("in_inventory");
    expect(resolveDecisionActions(ctx)).toEqual([
      "view_inventory",
      "view_wishlist",
    ]);
  });
});

describe("filterDecisionCards", () => {
  const rows = [
    {
      decision: "buy" as const,
      source: "image" as const,
      wishlistItemId: "wl-1",
      score: 82,
      itemName: "Blazer",
      summary: "Buy",
      createdAt: "2026-07-01T10:00:00Z",
    },
    {
      decision: "skip" as const,
      source: "manual" as const,
      wishlistItemId: null,
      score: 40,
      itemName: "Tee",
      summary: "Skip",
      createdAt: "2026-07-02T10:00:00Z",
    },
  ];

  it("filters by source, linkage, and high score", () => {
    expect(
      filterDecisionCards(rows, { source: "image", linkage: "linked" }),
    ).toHaveLength(1);
    expect(filterDecisionCards(rows, { highScore: true })).toHaveLength(1);
    expect(
      filterDecisionCards(rows, { sort: "high_score" })[0]?.itemName,
    ).toBe("Blazer");
  });
});

describe("matchLookupId", () => {
  it("matches category names case-insensitively", () => {
    const options = [
      { id: "c1", name: "Blazer" },
      { id: "c2", name: "Trousers" },
    ];
    expect(matchLookupId("blazer", options)).toBe("c1");
    expect(matchLookupId("unknown", options)).toBeNull();
  });
});
