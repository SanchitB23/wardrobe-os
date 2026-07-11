/**
 * Wishlist priority mapping — defaults unknown/null to medium.
 */

import { describe, expect, it } from "vitest";

import { mapWishlistPriorityForTest } from "@/features/shopping/repositories/shopping.repository";

describe("wishlist priority mapping", () => {
  it("round-trips low/medium/high and defaults unknowns", () => {
    expect(mapWishlistPriorityForTest({ priority: "low" })).toBe("low");
    expect(mapWishlistPriorityForTest({ priority: "medium" })).toBe("medium");
    expect(mapWishlistPriorityForTest({ priority: "high" })).toBe("high");
    expect(mapWishlistPriorityForTest({ priority: null })).toBe("medium");
    expect(mapWishlistPriorityForTest({ priority: "urgent" })).toBe("medium");
  });
});
