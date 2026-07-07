/**
 * Acquisition domain — Buy vs Skip types (RFC-001).
 *
 * Pure type definitions. The engine composes existing deterministic engines
 * (StyleDNA, Outfit, Health, Usage) into a single purchase verdict. AI is never
 * involved in producing these values — it may only explain them later.
 */

import type { UsageAnalytics } from "@/domain/analytics/UsageAnalyticsEngine";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type { StyleDNAItem } from "@/domain/style-dna";

/** A prospective (not-yet-owned) item the user is considering buying. */
export interface ProspectiveItem {
  name: string;
  category: string;
  subcategory?: string | null;
  brand?: string | null;
  color?: string | null;
  estimatedPrice?: number | null;
  material?: string | null;
  styleTags?: string[];
  formality?: string | null;
  intendedOccasions?: string[];
  /** Accepted but NOT parsed in RFC-001. */
  productUrl?: string | null;
  notes?: string | null;
}

export type BuyVsSkipInputSource = "manual" | "url" | "image";

/**
 * Optional learned-preference hints (RFC-004). When provided, they refine the
 * `preferenceFit` dimension on top of the built-in owner profile. Absent ⇒
 * behaviour is unchanged. AI never populates these; they come from the
 * deterministic Personalization Engine.
 */
export interface PreferenceHints {
  preferredStyles?: string[];
  preferredFormality?: string[];
}

export interface BuyVsSkipInput {
  item: ProspectiveItem;
  /** Active wardrobe, as StyleDNA-derivable items. */
  wardrobe: StyleDNAItem[];
  /** Optional precomputed analytics — read, never recomputed here. */
  health?: WardrobeHealth | null;
  usage?: UsageAnalytics | null;
  /** Where the prospective item came from (manual entry in RFC-001). */
  inputSource?: BuyVsSkipInputSource;
  /** Optional learned-preference hints (RFC-004); refine preferenceFit when present. */
  preferences?: PreferenceHints | null;
}

export type BuyDecision = "buy" | "consider" | "skip";

export type DimensionKey =
  | "duplicateRisk"
  | "gapFillValue"
  | "outfitCompatibility"
  | "usageProjection"
  | "costEfficiency"
  | "wardrobeHealthImpact"
  | "practicality"
  | "preferenceFit";

export interface DecisionDimension {
  /** 0–10. For `duplicateRisk`, higher means MORE duplication (worse). */
  score: number;
  /** 0–1. How much data backed this dimension. */
  confidence: number;
  reason: string;
}

export type BuyVsSkipBreakdown = Record<DimensionKey, DecisionDimension>;

export interface SimilarExistingItem {
  itemId: string;
  name: string;
  /** 0–1 overlap with the prospective item. */
  overlap: number;
  /** True when this similar item is rarely/never worn. */
  lowUse: boolean;
}

export interface PotentialOutfit {
  itemIds: string[];
  itemNames: string[];
  /** 0–10 outfit score from the OutfitEngine. */
  score: number;
}

export interface ConfidenceBreakdown {
  overall: number;
  byDimension: Record<DimensionKey, number>;
  /** Human-readable notes on what limited confidence. */
  notes: string[];
}

export interface DecisionTraceEntry {
  step: string;
  detail: string;
  value?: number;
}

/** Stable, machine-readable reason codes for downstream explanation/UX. */
export type ExplainabilityCode =
  | "GAP_MATCH"
  | "NO_GAP_MATCH"
  | "DUPLICATE_HIGH"
  | "DUPLICATE_LOW"
  | "DUPLICATE_LOW_USE"
  | "OUTFIT_STRONG"
  | "OUTFIT_WEAK"
  | "USAGE_STRONG"
  | "USAGE_RARE_CATEGORY"
  | "COST_EFFICIENT"
  | "COST_INEFFICIENT"
  | "COST_UNKNOWN"
  | "HEALTH_IMPROVES"
  | "HEALTH_WORSENS"
  | "PRACTICAL_OK"
  | "PRACTICAL_FRAGILE"
  | "PRACTICAL_CLIMATE_RISK"
  | "PREFERENCE_ALIGNED"
  | "PREFERENCE_MISMATCH"
  | "OVER_FORMAL"
  | "SPARSE_INPUT"
  | "LOW_CONFIDENCE"
  | "GUARD_DUPLICATE_CAP"
  | "GUARD_LOW_CONFIDENCE"
  | "DECISION_BUY"
  | "DECISION_CONSIDER"
  | "DECISION_SKIP";

export interface BuyVsSkipMetadata {
  engineVersion: string;
  generatedAt: string;
  inputSource: BuyVsSkipInputSource;
  /** Versions of the deterministic engines that contributed. */
  contributingEngines: {
    buyVsSkip: string;
    styleDNA: string;
    outfit: string;
    wardrobeHealth: string | null;
    usageAnalytics: string | null;
  };
}

export interface BuyVsSkipAnalysis {
  decision: BuyDecision;
  /** 0–100 composite buy score. */
  score: number;
  /** 0–1 overall confidence (mirrors confidenceBreakdown.overall). */
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  summary: string;
  scoreBreakdown: BuyVsSkipBreakdown;
  reasonsToBuy: string[];
  reasonsToSkip: string[];
  tradeoffs: string[];
  suggestedAlternatives: string[];
  similarExistingItems: SimilarExistingItem[];
  potentialOutfits: PotentialOutfit[];
  estimatedCostPerWear: number | null;
  /** 0–100 net effect on wardrobe balance (gap + health − duplication). */
  wardrobeImpactScore: number;
  decisionTrace: DecisionTraceEntry[];
  explainabilityCodes: ExplainabilityCode[];
  metadata: BuyVsSkipMetadata;
}

export interface BuyVsSkipOptions {
  /** Injected timestamp for deterministic metadata. */
  generatedAt?: string;
}

// ---------------------------------------------------------------------------
// RFC-003 — Shopping Screenshot Understanding.
// A prospective item extracted from a VisionAnalysis, ready for user review.
// ---------------------------------------------------------------------------

/** Per-field extraction confidence (0–1) so the UI can flag weak fields. */
export type ProspectiveFieldConfidence = Partial<
  Record<keyof ProspectiveItem, number>
>;

export interface ProspectiveItemCandidate {
  /** Pre-filled, user-editable. `estimatedPrice` is null — vision omits price. */
  item: ProspectiveItem;
  /** Overall extraction confidence (0–1), from the VisionAnalysis. */
  confidence: number;
  /** Band derived from confidence: poor | fair | good | excellent. */
  quality: "poor" | "fair" | "good" | "excellent";
  /** Fields the UI should flag as low-confidence for the user to double-check. */
  lowConfidenceFields: (keyof ProspectiveItem)[];
  fieldConfidence: ProspectiveFieldConfidence;
  /** Other detected products (multi-product images); user may switch. */
  alternatives: ProspectiveItem[];
  provenance: {
    imageHash: string;
    visionProvider: string;
    visionModel: string;
    sourceType: string;
  };
}
