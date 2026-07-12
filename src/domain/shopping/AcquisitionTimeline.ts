/**
 * Acquisition timeline composition (product UX) — pure presentation helpers.
 * Stages: Wishlist → Analysis → Purchased → Inventory Created → First Wear → ROI.
 * No ranking / intelligence; just lifecycle stages from persisted data.
 */

import type { BuyDecision } from "@/domain/acquisition";
import type { WishlistPriority, WishlistStatus } from "@/domain/shopping/types";

export type TimelineStage =
  | "wishlist"
  | "analysis"
  | "purchased"
  | "inventory_created"
  | "first_wear"
  | "roi";

/** @deprecated Use `"purchased"` — kept as alias for transitional call sites. */
export type LegacyPurchaseStage = "purchase";

export const TIMELINE_STAGE_ORDER: TimelineStage[] = [
  "wishlist",
  "analysis",
  "purchased",
  "inventory_created",
  "first_wear",
  "roi",
];

export const TIMELINE_STAGE_LABELS: Record<TimelineStage, string> = {
  wishlist: "Wishlist",
  analysis: "Analysis",
  purchased: "Purchased",
  inventory_created: "Inventory Created",
  first_wear: "First Wear",
  roi: "ROI",
};

export interface TimelineSubjectInput {
  id: string;
  name: string;
  category: string | null;
  status: WishlistStatus;
  priority: WishlistPriority;
  createdAt: string;
  updatedAt: string;
  /** Latest decision for this name, if any. */
  latestDecision: BuyDecision | null;
  decisionAt: string | null;
  /** Linked / matched purchase intent or purchases row. */
  purchased: boolean;
  purchaseDate: string | null;
  /** FK link to wardrobe item when converted (RFC-018C). */
  inventoryItemId?: string | null;
  wears: number;
  costPerWear: number | null;
}

export interface TimelineSubject {
  id: string;
  name: string;
  category: string | null;
  priority: WishlistPriority;
  /** Furthest stage reached. */
  stage: TimelineStage;
  stagesReached: TimelineStage[];
  decision: BuyDecision | null;
  inventoryItemId: string | null;
  wears: number;
  costPerWear: number | null;
  updatedAt: string;
}

export function resolveTimelineStage(
  input: TimelineSubjectInput,
): TimelineStage {
  const hasInventory = Boolean(input.inventoryItemId);
  const isPurchased =
    input.purchased || input.status === "purchased" || hasInventory;

  if (isPurchased) {
    if (input.wears >= 1 && input.costPerWear != null) return "roi";
    if (input.wears >= 1) return "first_wear";
    if (hasInventory) return "inventory_created";
    return "purchased";
  }
  if (input.latestDecision) return "analysis";
  return "wishlist";
}

export function stagesReachedUpTo(
  stage: TimelineStage,
  options?: { hasInventory?: boolean },
): TimelineStage[] {
  const idx = TIMELINE_STAGE_ORDER.indexOf(stage);
  const reached = TIMELINE_STAGE_ORDER.slice(0, idx + 1);
  // Inventory Created is optional in the path when purchases exist without
  // conversion; omit it unless inventory exists or it is the current stage.
  if (
    options?.hasInventory !== true &&
    stage !== "inventory_created" &&
    reached.includes("inventory_created")
  ) {
    return reached.filter((s) => s !== "inventory_created");
  }
  return reached;
}

export function buildTimelineSubjects(
  inputs: TimelineSubjectInput[],
): TimelineSubject[] {
  return inputs
    .map((input) => {
      const stage = resolveTimelineStage(input);
      return {
        id: input.id,
        name: input.name,
        category: input.category,
        priority: input.priority,
        stage,
        stagesReached: stagesReachedUpTo(stage, {
          hasInventory: Boolean(input.inventoryItemId),
        }),
        decision: input.latestDecision,
        inventoryItemId: input.inventoryItemId ?? null,
        wears: input.wears,
        costPerWear: input.costPerWear,
        updatedAt: input.updatedAt,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const PRIORITY_RANK: Record<WishlistPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Active wishlist sorted by user priority, then updatedAt desc — not engine scores. */
export function sortByUserPriority<
  T extends { priority: WishlistPriority; updatedAt: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
