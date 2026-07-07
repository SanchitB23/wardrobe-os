/**
 * Acquisition feature types. Re-exports the domain contracts the UI consumes so
 * components import from one place and never reach into the domain directly.
 */

export type {
  ProspectiveItem,
  BuyVsSkipAnalysis,
  BuyVsSkipBreakdown,
  BuyDecision,
  DimensionKey,
  DecisionDimension,
  SimilarExistingItem,
  PotentialOutfit,
  DecisionTraceEntry,
  ExplainabilityCode,
} from "@/domain/acquisition";
