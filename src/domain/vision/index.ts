/**
 * Vision domain (RFC-002) — the universal computer-vision capability. Pure:
 * provider interface + deterministic normalizer/engine. SDK-backed providers
 * live outside the domain and are injected.
 */

export { analyzeImage, type VisionEngineOptions } from "@/domain/vision/VisionEngine";
export { normalizeVision } from "@/domain/vision/VisionNormalizer";
export {
  qualityFromConfidence,
  aggregateConfidence,
  QUALITY_THRESHOLDS,
} from "@/domain/vision/VisionConfidence";
export {
  computeImageHash,
  buildVisionMetadata,
  VISION_ENGINE_VERSION,
} from "@/domain/vision/VisionMetadata";
export {
  buildStyleDNACandidate,
  type StyleDNACandidate,
} from "@/domain/vision/StyleDNACandidate";
export {
  StubVisionProvider,
  VisionError,
  VisionNotImplementedError,
  type VisionProvider,
  type VisionProviderId,
  type VisionCapabilities,
  type VisionErrorCode,
} from "@/domain/vision/VisionProvider";
export type {
  VisionSource,
  VisionImageInput,
  VisionAnalysis,
  VisionQuality,
  VisionMetadata,
  DetectedItem,
  ColorObservation,
  Segmentation,
  RawVisionResult,
  RawDetectedItem,
} from "@/domain/vision/VisionAnalysis";
