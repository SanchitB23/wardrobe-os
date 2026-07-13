/**
 * Style DNA — a derived, structured style profile for a single wardrobe item.
 *
 * No React, no Supabase, no AI. These are pure type definitions; the
 * {@link StyleDNAEngine} derives a {@link StyleDNA} deterministically from
 * existing item metadata. Downstream engines (e.g. recommendations) consume
 * StyleDNA rather than raw wardrobe fields.
 */

import type { SlotResolutionSource } from "@/domain/outfit/slot-resolution";
import type { FormalityEnum, OutfitSlot, UsageFrequency } from "@/types/wardrobe";

/** Structural subset of a wardrobe item the engine derives DNA from. */
export interface StyleDNAItem {
  id: string;
  name: string;
  category: string | null;
  subcategory?: string | null;
  color?: string | null;
  /** Coarse colour family, if already resolved; derived otherwise. */
  colorFamily?: string | null;
  brand?: string | null;
  formality?: FormalityEnum | null;
  usage?: UsageFrequency | null;
  rating?: number | null;
  material?: string | null;
  seasons?: readonly string[];
  styles?: readonly string[];
  tags?: readonly string[];
}

export type ColorTemperature = "warm" | "cool" | "neutral";

export interface ColorProfile {
  colorName: string | null;
  family: string | null;
  temperature: ColorTemperature;
  /** 0–1 approximate lightness of the colour. */
  lightness: number;
  /** 0–10 how strongly the colour reads (dark/light extremes are high). */
  contrast: number;
  /** 0–10 chromatic boldness (neutrals low, saturated hues high). */
  boldness: number;
  neutral: boolean;
}

export type TextureFamily =
  | "smooth"
  | "knit"
  | "denim"
  | "leather"
  | "technical"
  | "textured"
  | "unknown";

export type FabricWeight = "light" | "medium" | "heavy";
export type CareComplexity = "easy" | "moderate" | "delicate";

export interface TextureProfile {
  texture: TextureFamily;
  fabricWeight: FabricWeight;
  /** 0–10 (heavier fabrics score higher). */
  fabricWeightScore: number;
  careComplexity: CareComplexity;
  /** 0–10 (more demanding care scores higher). */
  careComplexityScore: number;
}

export type SeasonKey = "summer" | "monsoon" | "autumn" | "winter" | "spring";

export interface WeatherProfile {
  /** 0–10 suitability per season. */
  suitability: Record<SeasonKey, number>;
  minTempC: number;
  maxTempC: number;
}

export type OccasionKey =
  | "office"
  | "smartCasual"
  | "gym"
  | "wedding"
  | "travel"
  | "social"
  | "home"
  | "casual";

export interface OccasionProfile {
  /** 0–10 suitability per occasion. 0 = actively unsuitable. */
  suitability: Record<OccasionKey, number>;
  best: OccasionKey;
}

export interface StyleProfile {
  primary: string | null;
  secondary: string | null;
  formality: FormalityEnum | null;
  /** 0–10 formality (casual → formal). */
  formalityScore: number;
  /** 0–10 how work/professional-appropriate the piece reads. */
  professionalism: number;
}

export interface CompatibilityProfile {
  /** 0–10 how many contexts the piece works across. */
  versatility: number;
  /** 0–10 low-maintenance, packable, robust. */
  travelFriendliness: number;
  /** 0–10 comfortable and appropriate for a daily commute. */
  commuteFriendliness: number;
  /** 0–10 how visually loud the piece is. */
  visualBoldness: number;
  /**
   * True for pieces that are risky to wear in rough conditions — white/suede
   * or "hype" sneakers (e.g. Air Force 1) that scuff or stain easily.
   */
  protected: boolean;
}

export interface StyleDNA {
  itemId: string;
  name: string;
  slot: OutfitSlot;
  /** How the slot was resolved; "fallback" flags an unclassifiable category. */
  slotSource: SlotResolutionSource;
  formality: FormalityEnum | null;
  primaryStyle: string | null;
  secondaryStyle: string | null;
  color: ColorProfile;
  texture: TextureProfile;
  weather: WeatherProfile;
  occasion: OccasionProfile;
  style: StyleProfile;
  compatibility: CompatibilityProfile;
}

/** Contract for deriving {@link StyleDNA} from wardrobe items. */
export interface StyleDNAEngine {
  analyze(item: StyleDNAItem): StyleDNA;
  analyzeAll(items: readonly StyleDNAItem[]): StyleDNA[];
}
