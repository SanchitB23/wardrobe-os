/**
 * Acquisition domain (RFC-001) — deterministic Buy vs Skip.
 */

export { evaluateBuyVsSkip } from "@/domain/acquisition/BuyVsSkipEngine";
export {
  interpretShoppingImage,
  type InterpretOptions,
} from "@/domain/acquisition/ShoppingImageInterpreter";
export {
  BUY_VS_SKIP_ENGINE_VERSION,
  DIMENSION_WEIGHTS,
  DECISION_THRESHOLDS,
  GUARDS,
} from "@/domain/acquisition/constants";
export type {
  ProspectiveItem,
  ProspectiveItemCandidate,
  ProspectiveFieldConfidence,
  PreferenceHints,
  BuyVsSkipInput,
  BuyVsSkipInputSource,
  BuyVsSkipOptions,
  BuyVsSkipAnalysis,
  BuyVsSkipBreakdown,
  BuyVsSkipMetadata,
  BuyDecision,
  DimensionKey,
  DecisionDimension,
  ConfidenceBreakdown,
  DecisionTraceEntry,
  ExplainabilityCode,
  SimilarExistingItem,
  PotentialOutfit,
} from "@/domain/acquisition/types";
