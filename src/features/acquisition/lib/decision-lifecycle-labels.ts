/**
 * Decision lifecycle labels for Decision History cards (RFC-018C polish).
 * Presentation-only — does not change resolveDecisionLifecycle.
 */

import type { DecisionLifecycleStatus } from "@/domain/shopping";

export const DECISION_LIFECYCLE_ORDER: DecisionLifecycleStatus[] = [
  "analyzed",
  "on_wishlist",
  "purchased",
  "in_inventory",
  "worn",
  "roi",
];

export const DECISION_LIFECYCLE_LABELS: Record<DecisionLifecycleStatus, string> =
  {
    analyzed: "Analyzed",
    on_wishlist: "Wishlist",
    purchased: "Purchased",
    in_inventory: "Inventory Created",
    worn: "First Wear",
    roi: "ROI",
  };
