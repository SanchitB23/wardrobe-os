/**
 * Category Optimization shopping-handoff tests (RFC-015A).
 * Draft-only — confirm path is a separate explicit call.
 */

import { describe, expect, it } from "vitest";

import type { ReplacementOpportunity } from "@/domain/category-optimization";
import { proposeWishlistFromOpportunity } from "@/features/category-optimization/services/category-optimization.service";

describe("proposeWishlistFromOpportunity", () => {
  it("builds a draft wishlist payload without side effects", () => {
    const opportunity: ReplacementOpportunity = {
      id: "tpl-navy-knit-polo",
      name: "Navy Knit Polo",
      category: "tops",
      styleHints: ["polo", "navy"],
      rationale: "Diversify after consolidating near-duplicates.",
      reasonCodes: ["diversity_gap"],
      prospective: {
        name: "Navy Knit Polo",
        category: "tops",
        color: "navy",
        styleTags: ["polo", "navy"],
        notes: "Suggested from Category Optimization.",
      },
    };

    const draft = proposeWishlistFromOpportunity(opportunity);
    expect(draft.item.name).toBe("Navy Knit Polo");
    expect(draft.item.category).toBe("tops");
    expect(draft.source).toBe("manual");
    expect(draft.status).toBe("active");
    // No id → insert path only after confirmWishlistFromOpportunity.
    expect(draft.id).toBeUndefined();
  });
});
