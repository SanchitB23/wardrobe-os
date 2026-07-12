/**
 * RFC-018C Decision History polish — DecisionCardModel builder + wishlist nav.
 */

import { describe, expect, it } from "vitest";

import type { BuyVsSkipAnalysis, ProspectiveItem } from "@/domain/acquisition";
import {
  DECISION_LIFECYCLE_LABELS,
  DECISION_LIFECYCLE_ORDER,
} from "@/features/acquisition/lib/decision-lifecycle-labels";
import {
  buildDecisionCardModel,
  type DecisionWearStats,
} from "@/features/shopping/services/acquisitionPipeline.service";
import {
  readWishlistHighlight,
  wishlistItemHref,
  wishlistRowDomId,
} from "@/features/shopping/lib/wishlist-navigation";
import type {
  AcquisitionDecisionRecord,
  WishlistItem,
} from "@/features/shopping/types";

const stubAnalysis = {
  decision: "buy",
  score: 82,
  confidence: 0.9,
  summary: "Strong fit",
  reasonsToBuy: ["Gap in blazers"],
  reasonsToSkip: [],
  tradeoffs: [],
} as BuyVsSkipAnalysis;

const prospective = (
  overrides: Partial<ProspectiveItem> = {},
): ProspectiveItem => ({
  name: "Navy Blazer",
  category: "blazer",
  estimatedPrice: 120,
  ...overrides,
});

function decision(
  overrides: Partial<AcquisitionDecisionRecord> = {},
): AcquisitionDecisionRecord {
  return {
    id: "dec-1",
    itemName: "Navy Blazer",
    itemCategory: "blazer",
    decision: "buy",
    score: 82,
    confidence: 0.9,
    summary: "Strong fit",
    source: "manual",
    wishlistItemId: null,
    itemSnapshot: prospective(),
    analysis: stubAnalysis,
    createdAt: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

function wishlist(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: "wish-1",
    item: prospective({ name: "Navy Blazer Wishlist Name" }),
    status: "active",
    priority: "high",
    notes: null,
    source: "manual",
    sourceUrl: null,
    imageUrl: "https://cdn.example/wish.jpg",
    imageStoragePath: null,
    inventoryItemId: null,
    purchasedId: null,
    purchasePrice: null,
    purchaseDate: null,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildDecisionCardModel", () => {
  it("includes wishlist item name and image from linked wishlist", () => {
    const wish = wishlist();
    const card = buildDecisionCardModel(
      decision({ wishlistItemId: wish.id }),
      new Map([[wish.id, wish]]),
    );
    expect(card.wishlistItemName).toBe("Navy Blazer Wishlist Name");
    expect(card.imageUrl).toBe("https://cdn.example/wish.jpg");
    expect(card.lifecycleStatus).toBe("on_wishlist");
  });

  it("falls back to itemSnapshot.imagePreviewUrl for unlinked image decisions", () => {
    const card = buildDecisionCardModel(
      decision({
        source: "image",
        wishlistItemId: null,
        itemSnapshot: prospective({
          imagePreviewUrl: "https://cdn.example/preview.jpg",
        }),
      }),
      new Map(),
    );
    expect(card.imageUrl).toBe("https://cdn.example/preview.jpg");
    expect(card.source).toBe("image");
    expect(card.wishlistItemName).toBeNull();
  });

  it("populates First Wear / ROI from wear stats when inventory exists", () => {
    const wish = wishlist({
      status: "purchased",
      inventoryItemId: "inv-9",
    });
    const wears = new Map<string, DecisionWearStats>([
      ["inv-9", { wears: 3, costPerWear: 40 }],
    ]);
    const card = buildDecisionCardModel(
      decision({ wishlistItemId: wish.id }),
      new Map([[wish.id, wish]]),
      wears,
    );
    expect(card.wears).toBe(3);
    expect(card.costPerWear).toBe(40);
    expect(card.lifecycleStatus).toBe("roi");
    expect(card.actions).toEqual(["view_inventory", "view_wishlist"]);
  });

  it("stops at First Wear when wears exist but costPerWear is missing", () => {
    const wish = wishlist({
      status: "purchased",
      inventoryItemId: "inv-9",
    });
    const wears = new Map<string, DecisionWearStats>([
      ["inv-9", { wears: 1, costPerWear: null }],
    ]);
    const card = buildDecisionCardModel(
      decision({ wishlistItemId: wish.id }),
      new Map([[wish.id, wish]]),
      wears,
    );
    expect(card.lifecycleStatus).toBe("worn");
  });
});

describe("wishlist navigation deep links", () => {
  it("builds highlight query href", () => {
    expect(wishlistItemHref("wish-42")).toBe(
      "/acquisitions/wishlist?highlight=wish-42",
    );
  });

  it("reads highlight id from search params", () => {
    expect(
      readWishlistHighlight({ get: (k) => (k === "highlight" ? "abc" : null) }),
    ).toBe("abc");
    expect(readWishlistHighlight({ get: () => null })).toBeNull();
  });

  it("builds stable row DOM ids for scroll targets", () => {
    expect(wishlistRowDomId("wish-1")).toBe("wishlist-item-wish-1");
  });
});

describe("decision lifecycle wording", () => {
  it("uses Analyzed → Wishlist → Purchased → Inventory Created → First Wear → ROI", () => {
    expect(DECISION_LIFECYCLE_ORDER).toEqual([
      "analyzed",
      "on_wishlist",
      "purchased",
      "in_inventory",
      "worn",
      "roi",
    ]);
    expect(DECISION_LIFECYCLE_LABELS.analyzed).toBe("Analyzed");
    expect(DECISION_LIFECYCLE_LABELS.on_wishlist).toBe("Wishlist");
    expect(DECISION_LIFECYCLE_LABELS.purchased).toBe("Purchased");
    expect(DECISION_LIFECYCLE_LABELS.in_inventory).toBe("Inventory Created");
    expect(DECISION_LIFECYCLE_LABELS.worn).toBe("First Wear");
    expect(DECISION_LIFECYCLE_LABELS.roi).toBe("ROI");
  });
});

describe("convert purchase gate (integration contract)", () => {
  it("exposes mark_purchased and convert together only before purchase", () => {
    const wish = wishlist({ status: "active" });
    const card = buildDecisionCardModel(
      decision({ wishlistItemId: wish.id }),
      new Map([[wish.id, wish]]),
    );
    expect(card.actions).toContain("mark_purchased");
    expect(card.actions).toContain("convert_to_inventory");
    expect(card.actions).not.toContain("view_inventory");
  });

  it("drops mark_purchased after purchased status (wizard path)", () => {
    const wish = wishlist({ status: "purchased" });
    const card = buildDecisionCardModel(
      decision({ wishlistItemId: wish.id }),
      new Map([[wish.id, wish]]),
    );
    expect(card.actions).toEqual(["view_wishlist", "convert_to_inventory"]);
  });
});
