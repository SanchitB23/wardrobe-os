/**
 * Shopping Intelligence domain (RFC-018) — pure aggregation over the Acquisition
 * engine (RFC-001). Acquisition decides each item; these helpers rank the
 * wishlist, compute ROI, cluster duplicates, and assemble the dashboard. Nothing
 * here scores whether to buy — that verdict is always a `BuyVsSkipAnalysis`.
 */

export {
  buildShoppingDashboard,
  type ShoppingEngineEntry,
  type ShoppingEngineInput,
  type ShoppingEngineOptions,
} from "@/domain/shopping/ShoppingEngine";
export {
  computeNeedScore,
  priorityScore,
  scoreEntry,
  rankWishlist,
} from "@/domain/shopping/PriorityEngine";
export { computeShoppingROI } from "@/domain/shopping/ROIEngine";
export {
  analyzeDuplicates,
  itemOverlap,
  type DuplicateInput,
} from "@/domain/shopping/DuplicateEngine";
export { buildWishlistInsights } from "@/domain/shopping/ShoppingInsights";
export {
  normalizeProspectiveItem,
  isEvaluable,
  activeWishlist,
} from "@/domain/shopping/WishlistEngine";
export {
  computeRecommendationAccuracy,
  isAccuracyHit,
  outcomeByName,
  type DecisionOutcomePair,
  type RecommendationAccuracy,
} from "@/domain/shopping/recommendationAccuracy";
export {
  buildTimelineSubjects,
  resolveTimelineStage,
  sortByUserPriority,
  stagesReachedUpTo,
  TIMELINE_STAGE_LABELS,
  TIMELINE_STAGE_ORDER,
  type TimelineStage,
  type TimelineSubject,
  type TimelineSubjectInput,
} from "@/domain/shopping/AcquisitionTimeline";
export {
  SHOPPING_ENGINE_VERSION,
  DEFAULT_PRIORITY_WEIGHTS,
  NEED_BY_GAP_PRIORITY,
  NEED_BASELINE,
  NEED_NEUTRAL,
  DUPLICATE_OVERLAP_THRESHOLD,
  STRATEGY_TOP_N,
} from "@/domain/shopping/constants";
export type {
  WishlistStatus,
  WishlistPriority,
  WishlistSpec,
  WishlistEntry,
  PriorityWeights,
  ShoppingScores,
  ShoppingRecommendation,
  ShoppingPriority,
  PurchaseRecord,
  ShoppingROI,
  DuplicateMember,
  DuplicateCluster,
  DuplicateAnalysis,
  ShoppingTimelineEntry,
  ShoppingStrategyStep,
  WishlistInsights,
  ShoppingDashboard,
} from "@/domain/shopping/types";
