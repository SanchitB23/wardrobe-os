/**
 * Vision Intelligence v2 (RFC-019) — pure workflow engines over VisionAnalysis.
 * Perception stays in RFC-002; this package never calls a vision provider.
 */

export {
  VISION_INTELLIGENCE_VERSION,
  DUPLICATE_SIMILARITY_THRESHOLD,
  POSSIBLE_MATCH_SIMILARITY_THRESHOLD,
  MIN_DETECTION_CONFIDENCE,
  OUTFIT_MATCH_SIMILARITY_THRESHOLD,
} from "@/domain/vision-intelligence/constants";
export {
  scoreVisualSimilarity,
  rankInventoryMatches,
} from "@/domain/vision-intelligence/visualSimilarity";
export { analyzeVisualDuplicates } from "@/domain/vision-intelligence/DuplicateVision";
export { runClosetScan } from "@/domain/vision-intelligence/ClosetScanner";
export { recognizeOutfit } from "@/domain/vision-intelligence/OutfitRecognition";
export {
  buildReviewQueue,
  mergeReviewQueues,
  setReviewItemStatus,
  confirmReviewItem,
  dismissReviewItem,
  pendingReviewItems,
  makeReviewId,
} from "@/domain/vision-intelligence/ReviewQueue";
export type {
  VisionInventoryItem,
  ClosetDetectionKind,
  ClosetDetectionMatch,
  ClosetDetection,
  ClosetScanResult,
  OutfitPieceProposal,
  DetectedOutfit,
  VisualDuplicateHit,
  VisualDuplicateAnalysis,
  ReviewActionKind,
  ReviewItemStatus,
  ReviewQueueItem,
  ReviewQueue,
  VisionIntelligenceInput,
} from "@/domain/vision-intelligence/types";
