/**
 * ShoppingInsights (RFC-018) — pure, deterministic prose assembled from the
 * ranked queue + ROI + duplicates. This is decision-free narration text (like
 * the Lifestyle plan's trade-offs); the AI explanation layer may elaborate on
 * top, but never scores or decides.
 */

import type {
  DuplicateAnalysis,
  ShoppingPriority,
  ShoppingROI,
  WishlistInsights,
} from "@/domain/shopping/types";

export function buildWishlistInsights(
  priority: ShoppingPriority,
  roi: ShoppingROI,
  duplicates: DuplicateAnalysis,
): WishlistInsights {
  if (priority.length === 0) {
    return {
      summary: "Your wishlist is empty — add items you're considering to see priorities.",
      topReasons: [],
    };
  }

  const top = priority[0];
  const parts = [
    `${priority.length} item${priority.length === 1 ? "" : "s"} on your wishlist.`,
    `Top priority: ${top.item.name} (${top.analysis.decision}, buy score ${top.analysis.score}).`,
  ];
  if (duplicates.wishlistDuplicateCount > 0) {
    parts.push(
      `${duplicates.wishlistDuplicateCount} possible duplicate${
        duplicates.wishlistDuplicateCount === 1 ? "" : "s"
      } to review.`,
    );
  }
  if (roi.averageCostPerWear != null) {
    parts.push(`Realized average cost-per-wear ${roi.averageCostPerWear}.`);
  }

  const topReasons = priority.slice(0, 3).map((r) => {
    const why =
      r.analysis.reasonsToBuy[0] ??
      r.scores.reasonCodes[0] ??
      "ranked by need, impact, and verdict";
    return `${r.item.name}: ${why}`;
  });

  return { summary: parts.join(" "), topReasons };
}
