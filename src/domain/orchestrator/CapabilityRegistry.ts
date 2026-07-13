/**
 * CapabilityRegistry (RFC-005) — the declarative map of capability → { deps, run }.
 * Each `run` is a thin, pure adapter that invokes an EXISTING engine with its
 * scoped slice of the ExecutionContext. Adding a capability = one entry here;
 * no consumer changes.
 *
 * The orchestrator owns which capabilities run and in what order. It adds NO
 * scoring/eligibility/ranking of its own — every such value comes verbatim from
 * an engine output. No AI, no Supabase, no React, no business logic.
 */

import type {
  CapabilityContext,
  CapabilityDefinition,
  CapabilityRegistry,
} from "@/domain/orchestrator/Capability";
import { generateInsights } from "@/domain/analytics/InsightEngine";
import { generateOutfits } from "@/domain/generation/OutfitGenerationEngine";
import { recommendV2 } from "@/domain/recommendation";
import type { RecommendationV2 } from "@/domain/recommendation";
import { evaluateBuyVsSkip, interpretShoppingImage } from "@/domain/acquisition";
import type {
  BuyVsSkipAnalysis,
  ProspectiveItem,
  ProspectiveItemCandidate,
} from "@/domain/acquisition";
import type { VisionAnalysis } from "@/domain/vision";
import { buildPairingReport } from "@/domain/pairing";
import { deriveStyleDNA, type StyleDNAItem } from "@/domain/style-dna";

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function occasionOf(ctx: CapabilityContext): string | null {
  const raw = ctx.shared.inputs.occasion;
  return typeof raw === "string" ? raw : null;
}

/** health — surface the engine-derived WardrobeHealth already in context. */
const health: CapabilityDefinition = {
  id: "health",
  dependsOn: [],
  run: (ctx) => ctx.shared.health,
};

/** usage — surface the engine-derived UsageAnalytics already in context. */
const usage: CapabilityDefinition = {
  id: "usage",
  dependsOn: [],
  run: (ctx) => ctx.shared.usage,
};

/** personalization — surface the derived preference snapshot (RFC-004). */
const personalization: CapabilityDefinition = {
  id: "personalization",
  dependsOn: [],
  run: (ctx) => ctx.shared.recommendation.preferences,
};

/** analytics — compose the InsightEngine over health + usage (+ purchase). */
const analytics: CapabilityDefinition = {
  id: "analytics",
  dependsOn: ["health", "usage"],
  run: (ctx) => {
    const { health: h, usage: u, purchase } = ctx.shared;
    if (!h || !u) {
      throw new Error("analytics requires wardrobe health + usage analytics.");
    }
    return generateInsights(
      { wardrobeHealth: h, usageAnalytics: u, purchaseAnalytics: purchase ?? undefined },
      { generatedAt: ctx.shared.generatedAt },
    );
  },
};

/** weather (RFC-011) — surface the deterministic WeatherSnapshot the service
 *  placed on the RecommendationContext (produced by the Weather Runtime). It
 *  DECIDES nothing; it only exposes weather. outfit/recommendation depend on it,
 *  and failure isolation means recommendation still runs on the always-present
 *  (possibly seasonal-fallback) snapshot. Pure — reads context only. */
export const weatherCapability: CapabilityDefinition = {
  id: "weather",
  dependsOn: [],
  run: (ctx) => ctx.shared.recommendation.weather,
  confidenceOf: (out) => (out as { confidence?: number } | null)?.confidence ?? null,
};

/** outfit — generate candidate outfits from the wardrobe. */
const outfit: CapabilityDefinition = {
  id: "outfit",
  dependsOn: ["weather"],
  run: (ctx) =>
    generateOutfits(ctx.shared.recommendation, {
      occasion: occasionOf(ctx),
      limit: numberOr(ctx.shared.inputs.limit, 6),
    }),
};

/** recommendation — RFC-012 v2 ranking of saved + generated outfits. Returns the
 *  ranked array (the full RecommendationResult's `.recommendations`) so existing
 *  consumers (Lifestyle, AI narration) keep receiving an array. */
const recommendation: CapabilityDefinition = {
  id: "recommendation",
  dependsOn: ["outfit", "personalization", "weather"],
  run: (ctx) =>
    recommendV2(ctx.shared.recommendation, {
      occasion: occasionOf(ctx),
      limit: numberOr(ctx.shared.inputs.limit, 12),
    }).recommendations,
  confidenceOf: (out) => {
    const recs = out as RecommendationV2[];
    return Array.isArray(recs) && recs.length > 0 ? (recs[0].confidence ?? null) : null;
  },
};

/** vision — interpret an (already-extracted) VisionAnalysis into a candidate. */
const vision: CapabilityDefinition = {
  id: "vision",
  dependsOn: [],
  run: (ctx) => {
    const analysis = ctx.shared.inputs.visionAnalysis as VisionAnalysis | undefined;
    if (!analysis) throw new Error("vision requires inputs.visionAnalysis.");
    return interpretShoppingImage(analysis);
  },
  confidenceOf: (out) => (out as ProspectiveItemCandidate | null)?.confidence ?? null,
};

/**
 * acquisition — Buy vs Skip for a prospective item. Uses an upstream vision
 * candidate when present (screenshot flow), else `inputs.prospectiveItem`.
 */
const acquisition: CapabilityDefinition = {
  id: "acquisition",
  dependsOn: ["personalization"],
  run: (ctx) => {
    const fromVision = (ctx.upstream.vision as ProspectiveItemCandidate | undefined)?.item;
    const item = fromVision ?? (ctx.shared.inputs.prospectiveItem as ProspectiveItem | undefined);
    if (!item) {
      throw new Error(
        "acquisition requires inputs.prospectiveItem or an upstream vision candidate.",
      );
    }
    const prefs = ctx.shared.recommendation.preferences;
    return evaluateBuyVsSkip(
      {
        item,
        wardrobe: ctx.shared.wardrobe,
        health: ctx.shared.health,
        usage: ctx.shared.usage,
        preferences: {
          preferredStyles: prefs.preferredStyles,
          preferredFormality: prefs.preferredFormality,
        },
        inputSource: fromVision ? "image" : "manual",
      },
      { generatedAt: ctx.shared.generatedAt },
    );
  },
  confidenceOf: (out) => (out as BuyVsSkipAnalysis | null)?.confidence ?? null,
};

/**
 * pairing (RFC-031) — item-anchored "what goes with this?" over the active
 * wardrobe. The anchor must be present in the context wardrobe (which is
 * active-only), so retired/unknown items fail cleanly — the orchestrator never
 * guesses an anchor.
 */
const pairing: CapabilityDefinition = {
  id: "pairing",
  dependsOn: [],
  run: (ctx) => {
    const itemId = ctx.shared.inputs.itemId;
    if (typeof itemId !== "string" || itemId.length === 0) {
      throw new Error("pairing requires inputs.itemId.");
    }
    const anchorItem = ctx.shared.wardrobe.find((entry) => entry.id === itemId);
    if (!anchorItem) {
      throw new Error(`pairing: item "${itemId}" is not in the active wardrobe.`);
    }
    const toEntry = (item: StyleDNAItem) => ({ item, dna: deriveStyleDNA(item) });
    return buildPairingReport(
      toEntry(anchorItem),
      ctx.shared.wardrobe.filter((entry) => entry.id !== itemId).map(toEntry),
    );
  },
};

/** The registered capabilities (reserved future ones are intentionally absent). */
export const DEFAULT_CAPABILITY_REGISTRY: CapabilityRegistry = {
  health,
  usage,
  personalization,
  weather: weatherCapability,
  analytics,
  outfit,
  recommendation,
  vision,
  acquisition,
  pairing,
};

/** Build a registry from explicit definitions (for tests / future consumers). */
export function createCapabilityRegistry(
  definitions: CapabilityDefinition[],
): CapabilityRegistry {
  const registry: CapabilityRegistry = {};
  for (const def of definitions) registry[def.id] = def;
  return registry;
}
