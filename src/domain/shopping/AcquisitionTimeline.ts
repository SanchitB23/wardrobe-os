/**
 * Acquisition timeline composition (product UX) — pure presentation helpers.
 * Stages: Wishlist → Analysis → Purchase → First Wear → ROI.
 * No ranking / intelligence; just lifecycle stages from persisted data.
 */

import type { BuyDecision } from "@/domain/acquisition";
import type { WishlistPriority, WishlistStatus } from "@/domain/shopping/types";

export type TimelineStage =
  | "wishlist"
  | "analysis"
  | "purchase"
  | "first_wear"
  | "roi";

export const TIMELINE_STAGE_ORDER: TimelineStage[] = [
  "wishlist",
  "analysis",
  "purchase",
  "first_wear",
  "roi",
];

export const TIMELINE_STAGE_LABELS: Record<TimelineStage, string> = {
  wishlist: "Wishlist",
  analysis: "Analysis",
  purchase: "Purchase",
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
  /** Linked / matched purchase. */
  purchased: boolean;
  purchaseDate: string | null;
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
  wears: number;
  costPerWear: number | null;
  updatedAt: string;
}

export function resolveTimelineStage(
  input: TimelineSubjectInput,
): TimelineStage {
  if (input.purchased || input.status === "purchased") {
    if (input.wears >= 1 && input.costPerWear != null) return "roi";
    if (input.wears >= 1) return "first_wear";
    return "purchase";
  }
  if (input.latestDecision) return "analysis";
  return "wishlist";
}

export function stagesReachedUpTo(stage: TimelineStage): TimelineStage[] {
  const idx = TIMELINE_STAGE_ORDER.indexOf(stage);
  return TIMELINE_STAGE_ORDER.slice(0, idx + 1);
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
        stagesReached: stagesReachedUpTo(stage),
        decision: input.latestDecision,
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
