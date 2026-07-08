/**
 * BuyVsSkipEngine (RFC-001) — deterministic purchase decision support.
 *
 * Pure TypeScript: no React, no Supabase, no AI, no I/O. Given a prospective
 * item + the existing wardrobe (and optional health/usage analytics), it scores
 * eight dimensions, combines them into a 0–100 buy score, and returns a
 * `buy | consider | skip` verdict with a full breakdown, trace, and reason
 * codes. Identical inputs (+ injected `generatedAt`) always produce identical
 * output.
 *
 * AI is never involved in producing any value here — it may only explain the
 * result afterwards. See docs/rfc/RFC-001-Acquisition-Engine-Buy-vs-Skip.md.
 */

import { deriveStyleDNA, type StyleDNA, type StyleDNAItem } from "@/domain/style-dna";
import {
  evaluateOutfit,
  OUTFIT_ENGINE_VERSION,
  type OutfitEngineItem,
} from "@/domain/outfit";
import type { OutfitSlot } from "@/types/wardrobe";
import {
  BUY_VS_SKIP_ENGINE_VERSION,
  CLIMATE,
  COST_PER_WEAR,
  DECISION_THRESHOLDS,
  DIMENSION_WEIGHTS,
  GUARDS,
  INVERSE_DIMENSIONS,
  OUTFIT_COMPAT,
  PREFERENCE_PROFILE,
} from "@/domain/acquisition/constants";
import type {
  BuyDecision,
  BuyVsSkipAnalysis,
  BuyVsSkipBreakdown,
  BuyVsSkipInput,
  BuyVsSkipOptions,
  DecisionDimension,
  DecisionTraceEntry,
  DimensionKey,
  ExplainabilityCode,
  PotentialOutfit,
  PreferenceHints,
  ProspectiveItem,
  SimilarExistingItem,
} from "@/domain/acquisition/types";

const STYLE_DNA_VERSION = "1.0.0";
const CORE_SLOTS: OutfitSlot[] = ["top", "bottom", "footwear"];

const clamp = (n: number, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim();
}
function tokens(value: string | null | undefined): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

/** Map a prospective item to the StyleDNAItem shape (deterministic). */
function prospectiveToStyleItem(item: ProspectiveItem): StyleDNAItem {
  return {
    id: "__prospective__",
    name: item.name,
    category: item.category,
    subcategory: item.subcategory ?? null,
    color: item.color ?? null,
    brand: item.brand ?? null,
    formality: (item.formality ?? null) as StyleDNAItem["formality"],
    rating: null,
    material: item.material ?? null,
    seasons: [],
    styles: item.styleTags ?? [],
    tags: item.intendedOccasions ?? [],
  };
}

function toEngineItem(item: StyleDNAItem, dna: StyleDNA): OutfitEngineItem {
  return {
    slot: dna.slot,
    name: item.name,
    formality: item.formality ?? null,
    colorHex: null,
    colorName: item.color ?? null,
    seasonTags: item.seasons ?? [],
    occasionTags: item.tags ?? [],
    material: item.material ?? null,
    rating: item.rating ?? null,
  };
}

interface WardrobeEntry {
  item: StyleDNAItem;
  dna: StyleDNA;
}

// ---------------------------------------------------------------------------
// Dimension scorers. Each returns a DecisionDimension plus codes/extra.
// ---------------------------------------------------------------------------

/** Garment-type tokens from name + subcategory, excluding colour words. */
function garmentTokens(item: StyleDNAItem): Set<string> {
  const colorTokens = new Set(tokens(item.color));
  return new Set(
    [...tokens(item.name), ...tokens(item.subcategory)].filter((t) => !colorTokens.has(t)),
  );
}

/** 0–1 garment-type similarity (polo vs shirt vs sweater are different). */
function typeSimilarity(a: StyleDNAItem, b: StyleDNAItem): number {
  const at = garmentTokens(a);
  const bt = garmentTokens(b);
  if (at.size === 0 || bt.size === 0) return 0.5; // unknown type → neutral
  const shared = [...at].filter((t) => bt.has(t)).length;
  return shared === 0 ? 0 : Math.min(1, shared / 2);
}

/**
 * 0–1 similarity between two same-slot items. Colour/formality/style/occasion
 * give a base overlap, then garment type gates it: a navy polo and a navy shirt
 * are NOT duplicates even though both are navy smart-casual tops.
 */
function overlapScore(
  aItem: StyleDNAItem,
  a: StyleDNA,
  bItem: StyleDNAItem,
  b: StyleDNA,
): number {
  if (a.slot !== b.slot) return 0;
  let partial = 0;
  if (a.color.family && a.color.family === b.color.family) partial += 0.35;
  if (a.formality && a.formality === b.formality) partial += 0.25;
  if (a.primaryStyle && a.primaryStyle === b.primaryStyle) partial += 0.2;
  if (a.occasion.best === b.occasion.best) partial += 0.2;
  const typeSim = typeSimilarity(aItem, bItem);
  return round1(partial * (0.5 + 0.5 * typeSim));
}

function scoreDuplicateRisk(
  prospItem: StyleDNAItem,
  itemDna: StyleDNA,
  wardrobe: WardrobeEntry[],
  lowUseIds: Set<string>,
): {
  dim: DecisionDimension;
  codes: ExplainabilityCode[];
  similar: SimilarExistingItem[];
  lowUseDuplicate: boolean;
} {
  const similar: SimilarExistingItem[] = wardrobe
    .map((entry) => ({
      itemId: entry.item.id,
      name: entry.item.name,
      overlap: overlapScore(prospItem, itemDna, entry.item, entry.dna),
      lowUse: lowUseIds.has(entry.item.id),
    }))
    .filter((s) => s.overlap >= GUARDS.similarOverlap)
    .sort((a, b) => b.overlap - a.overlap);

  const maxOverlap = similar[0]?.overlap ?? 0;
  const countBoost = Math.min(similar.length * 1.5, 4);
  const score = clamp(maxOverlap * 10 + (similar.length > 1 ? countBoost : 0));
  const lowUseDuplicate = similar.some((s) => s.lowUse);

  const codes: ExplainabilityCode[] = [];
  if (score >= GUARDS.duplicateCap) codes.push("DUPLICATE_HIGH");
  else codes.push("DUPLICATE_LOW");
  if (lowUseDuplicate) codes.push("DUPLICATE_LOW_USE");

  const reason =
    similar.length === 0
      ? "No strongly overlapping items in your wardrobe."
      : `Overlaps ${similar.length} existing item(s), closest "${similar[0].name}"${
          lowUseDuplicate ? " (some rarely worn)" : ""
        }.`;

  return {
    dim: { score: round1(score), confidence: 0.9, reason },
    codes,
    similar: similar.slice(0, 6),
    lowUseDuplicate,
  };
}

function scoreGapFillValue(
  item: ProspectiveItem,
  health: BuyVsSkipInput["health"],
): { dim: DecisionDimension; codes: ExplainabilityCode[] } {
  if (!health || health.gaps.length === 0) {
    return {
      dim: {
        score: 5,
        confidence: health ? 0.5 : 0.2,
        reason: health
          ? "No open wardrobe gaps to fill."
          : "Wardrobe health unavailable — gap fit unknown.",
      },
      codes: [health ? "NO_GAP_MATCH" : "NO_GAP_MATCH"],
    };
  }

  const itemTokens = new Set([
    ...tokens(item.name),
    ...tokens(item.category),
    ...tokens(item.subcategory),
    ...tokens(item.color),
    ...tokens(item.formality),
  ]);

  let best: { label: string; priority: string; matched: number } | null = null;
  for (const gap of health.gaps) {
    const gapTokens = tokens(gap.label);
    if (gapTokens.length === 0) continue;
    // Category gaps have single-word labels ("tops", "footwear") that could never
    // reach a fixed 2-token threshold, so the highest-weighted gap-fill signal
    // never fired for them. Require all tokens to match for a 1-word label and at
    // least 2 for multi-word staple labels.
    const required = Math.min(2, gapTokens.length);
    const matched = gapTokens.filter((t) => itemTokens.has(t)).length;
    if (matched >= required && (!best || matched > best.matched)) {
      best = { label: gap.label, priority: gap.priority, matched };
    }
  }

  if (!best) {
    return {
      dim: { score: 3, confidence: 0.8, reason: "Doesn't match any known wardrobe gap." },
      codes: ["NO_GAP_MATCH"],
    };
  }

  const priorityScore = best.priority === "high" ? 10 : best.priority === "medium" ? 8 : 6;
  return {
    dim: {
      score: priorityScore,
      confidence: 0.9,
      reason: `Fills the ${best.priority}-priority gap "${best.label}".`,
    },
    codes: ["GAP_MATCH"],
  };
}

function scoreOutfitCompatibility(
  prospective: { item: StyleDNAItem; dna: StyleDNA },
  wardrobe: WardrobeEntry[],
): { dim: DecisionDimension; codes: ExplainabilityCode[]; potential: PotentialOutfit[] } {
  const bySlot = new Map<OutfitSlot, WardrobeEntry[]>();
  for (const entry of wardrobe) {
    const list = bySlot.get(entry.dna.slot) ?? [];
    list.push(entry);
    bySlot.set(entry.dna.slot, list);
  }
  const topK = (slot: OutfitSlot) =>
    (bySlot.get(slot) ?? [])
      .slice()
      .sort((a, b) => (b.item.rating ?? 0) - (a.item.rating ?? 0) || a.item.name.localeCompare(b.item.name))
      .slice(0, OUTFIT_COMPAT.topKPerSlot);

  const neededSlots = CORE_SLOTS.filter((slot) => slot !== prospective.dna.slot);
  const slotOptions = neededSlots.map(topK);

  // If a needed slot has no items, we can't build core outfits.
  if (slotOptions.some((opts) => opts.length === 0)) {
    return {
      dim: {
        score: 5,
        confidence: 0.3,
        reason: "Not enough complementary items to gauge outfit potential.",
      },
      codes: ["OUTFIT_WEAK"],
      potential: [],
    };
  }

  const prospectiveEngineItem = toEngineItem(prospective.item, prospective.dna);
  const candidates: PotentialOutfit[] = [];
  // Deterministic bounded cartesian product across needed slots.
  const build = (index: number, chosen: WardrobeEntry[]) => {
    if (candidates.length >= OUTFIT_COMPAT.maxCandidates) return;
    if (index === slotOptions.length) {
      const engineItems = [prospectiveEngineItem, ...chosen.map((e) => toEngineItem(e.item, e.dna))];
      const analysis = evaluateOutfit({ items: engineItems });
      candidates.push({
        itemIds: chosen.map((e) => e.item.id),
        itemNames: [prospective.item.name, ...chosen.map((e) => e.item.name)],
        score: round1(analysis.overallScore),
      });
      return;
    }
    for (const option of slotOptions[index]) {
      build(index + 1, [...chosen, option]);
      if (candidates.length >= OUTFIT_COMPAT.maxCandidates) return;
    }
  };
  build(0, []);

  const best = Math.max(...candidates.map((c) => c.score), 0);
  const hqCount = candidates.filter((c) => c.score >= GUARDS.highQualityOutfit).length;
  const hqRatio = candidates.length > 0 ? hqCount / candidates.length : 0;
  const score = clamp(best * 0.6 + hqRatio * 10 * 0.4);

  const potential = candidates
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, OUTFIT_COMPAT.maxReturned);

  return {
    dim: {
      score: round1(score),
      confidence: 0.8,
      reason: `${hqCount} high-quality outfit(s) possible; best scores ${best}/10.`,
    },
    codes: [score >= GUARDS.highQualityOutfit ? "OUTFIT_STRONG" : "OUTFIT_WEAK"],
    potential,
  };
}

function scoreUsageProjection(
  item: ProspectiveItem,
  usage: BuyVsSkipInput["usage"],
): { dim: DecisionDimension; codes: ExplainabilityCode[]; projectedWears: number } {
  const intentional = (item.intendedOccasions?.length ?? 0) > 0;
  if (!usage) {
    return {
      dim: { score: 5, confidence: 0.2, reason: "No usage data — wear likelihood unknown." },
      codes: [],
      projectedWears: COST_PER_WEAR.fallbackProjectedWears,
    };
  }
  const cat = normalize(item.category);
  const summary = usage.categoryUsage.find((c) => normalize(c.category) === cat);
  if (!summary) {
    return {
      dim: {
        score: intentional ? 6 : 5,
        confidence: 0.4,
        reason: "No history for this category yet.",
      },
      codes: [],
      projectedWears: COST_PER_WEAR.fallbackProjectedWears,
    };
  }
  // wearsPerItem → 0–10 (8+ wears/item = fully worn).
  const base = clamp((summary.wearsPerItem / 8) * 10);
  const rare = summary.wearsPerItem < 1.5 || summary.neverWornCount >= summary.itemCount * 0.5;
  const score = rare && !intentional ? clamp(base - 3) : base;
  const codes: ExplainabilityCode[] = [];
  if (score >= 7) codes.push("USAGE_STRONG");
  if (rare) codes.push("USAGE_RARE_CATEGORY");
  return {
    dim: {
      score: round1(score),
      confidence: 0.85,
      reason: rare
        ? `"${summary.category}" is a low-use category (${round1(summary.wearsPerItem)} wears/item).`
        : `"${summary.category}" items average ${round1(summary.wearsPerItem)} wears each.`,
    },
    codes,
    projectedWears: Math.max(summary.wearsPerItem * 4, 4),
  };
}

function scoreCostEfficiency(
  item: ProspectiveItem,
  projectedWears: number,
): { dim: DecisionDimension; codes: ExplainabilityCode[]; costPerWear: number | null } {
  if (item.estimatedPrice == null || item.estimatedPrice <= 0) {
    return {
      dim: { score: 5, confidence: 0, reason: "No price provided — cost-per-wear unknown." },
      codes: ["COST_UNKNOWN"],
      costPerWear: null,
    };
  }
  const wears = Math.max(projectedWears, 1);
  const cpw = item.estimatedPrice / wears;
  // Lower cost-per-wear = better.
  const span = COST_PER_WEAR.inefficient - COST_PER_WEAR.efficient;
  const score = clamp(10 - ((cpw - COST_PER_WEAR.efficient) / span) * 10);
  return {
    dim: {
      score: round1(score),
      confidence: 0.7,
      reason: `Est. cost-per-wear ≈ ${Math.round(cpw)} over ~${Math.round(wears)} wears.`,
    },
    codes: [score >= 6 ? "COST_EFFICIENT" : "COST_INEFFICIENT"],
    costPerWear: Math.round(cpw),
  };
}

function scoreWardrobeHealthImpact(
  itemDna: StyleDNA,
  item: ProspectiveItem,
  health: BuyVsSkipInput["health"],
): { dim: DecisionDimension; codes: ExplainabilityCode[] } {
  if (!health) {
    return {
      dim: { score: 5, confidence: 0.2, reason: "Wardrobe health unavailable." },
      codes: [],
    };
  }
  // Worsens an over-represented cluster?
  const worsens = health.duplicates.some(
    (d) =>
      normalize(d.colorFamily) === normalize(itemDna.color.family) &&
      normalize(d.formality) === normalize(item.formality) &&
      d.severity === "excess",
  );
  if (worsens) {
    return {
      dim: {
        score: 3,
        confidence: 0.8,
        reason: "Adds to an already over-represented colour/formality cluster.",
      },
      codes: ["HEALTH_WORSENS"],
    };
  }
  // Improves a weak area? (gap already covered by gapFillValue; here, balance.)
  const improves = health.gaps.length > 0 || health.weaknesses.length > 0;
  return {
    dim: {
      score: improves ? 7 : 5,
      confidence: 0.7,
      reason: improves
        ? "Could help balance current wardrobe weaknesses."
        : "Neutral effect on wardrobe balance.",
    },
    codes: improves ? ["HEALTH_IMPROVES"] : [],
  };
}

function scorePracticality(itemDna: StyleDNA): {
  dim: DecisionDimension;
  codes: ExplainabilityCode[];
} {
  const compat = itemDna.compatibility;
  const hotSuit =
    CLIMATE.hotSeasons
      .map((s) => itemDna.weather.suitability[s as keyof typeof itemDna.weather.suitability] ?? 5)
      .reduce((a, b) => a + b, 0) / CLIMATE.hotSeasons.length;
  const careDrag = itemDna.texture.careComplexityScore; // 0–10, higher = worse
  const base =
    compat.commuteFriendliness * 0.35 +
    compat.travelFriendliness * 0.2 +
    hotSuit * 0.3 +
    (10 - careDrag) * 0.15;
  const score = clamp(base - (compat.protected ? 1.5 : 0));
  const codes: ExplainabilityCode[] = [];
  if (compat.protected) codes.push("PRACTICAL_FRAGILE");
  if (hotSuit < 4) codes.push("PRACTICAL_CLIMATE_RISK");
  if (score >= 6 && codes.length === 0) codes.push("PRACTICAL_OK");
  return {
    dim: {
      score: round1(score),
      confidence: 0.7,
      reason: compat.protected
        ? "Practical, but a protected/fragile piece to wear carefully."
        : hotSuit < 4
          ? "May be warm for the local climate much of the year."
          : "Practical for daily commute and climate.",
    },
    codes,
  };
}

function scorePreferenceFit(
  item: ProspectiveItem,
  itemDna: StyleDNA,
  hints?: PreferenceHints | null,
): { dim: DecisionDimension; codes: ExplainabilityCode[] } {
  let score = 6;
  const codes: ExplainabilityCode[] = [];
  const styleHay = normalize(`${item.styleTags?.join(" ")} ${itemDna.primaryStyle} ${itemDna.secondaryStyle}`);
  if (PREFERENCE_PROFILE.preferredStyles.some((s) => styleHay.includes(s))) score += 2;

  // RFC-004: refine with learned preferences when provided (additive).
  let usedHints = false;
  if (hints) {
    const learnedStyles = (hints.preferredStyles ?? []).map(normalize).filter(Boolean);
    if (learnedStyles.some((s) => styleHay.includes(s))) {
      score += 1;
      usedHints = true;
    }
    const learnedFormality = (hints.preferredFormality ?? []).map(normalize);
    if (learnedFormality.includes(normalize(item.formality))) {
      score += 0.5;
      usedHints = true;
    }
  }

  const intended = (item.intendedOccasions ?? []).map(normalize);
  const isOverFormal = PREFERENCE_PROFILE.overFormal.includes(
    normalize(item.formality) as (typeof PREFERENCE_PROFILE.overFormal)[number],
  );
  const formalIntended = intended.some((o) => ["formal", "wedding", "business"].some((k) => o.includes(k)));
  if (isOverFormal && !formalIntended) {
    score -= 3;
    codes.push("OVER_FORMAL");
  }

  if (itemDna.slot === "footwear") {
    const hay = normalize(`${item.name} ${item.subcategory}`);
    if (PREFERENCE_PROFILE.sneakerHints.some((k) => hay.includes(k))) score += 1.5;
    else if (PREFERENCE_PROFILE.formalFootwearHints.some((k) => hay.includes(k))) score -= 1.5;
  }

  score = clamp(score);
  codes.push(score >= 6 ? "PREFERENCE_ALIGNED" : "PREFERENCE_MISMATCH");
  return {
    dim: {
      score: round1(score),
      confidence: usedHints ? 0.7 : 0.6,
      reason:
        isOverFormal && !formalIntended
          ? "Leans more formal than your usual smart-casual direction."
          : "Fits your modern smart-casual style direction.",
    },
    codes,
  };
}

// ---------------------------------------------------------------------------
// Engine entry point.
// ---------------------------------------------------------------------------

export function evaluateBuyVsSkip(
  input: BuyVsSkipInput,
  options: BuyVsSkipOptions = {},
): BuyVsSkipAnalysis {
  const trace: DecisionTraceEntry[] = [];
  const codes = new Set<ExplainabilityCode>();

  const prospectiveItem = prospectiveToStyleItem(input.item);
  const itemDna = deriveStyleDNA(prospectiveItem);
  const wardrobe: WardrobeEntry[] = input.wardrobe.map((item) => ({
    item,
    dna: deriveStyleDNA(item),
  }));

  // Low-use item ids (from usage analytics) for duplicate weighting.
  const lowUseIds = new Set<string>();
  for (const u of input.usage?.staleItems ?? []) lowUseIds.add(u.id);
  for (const u of input.usage?.leastWornActiveItems ?? []) lowUseIds.add(u.id);

  // --- dimensions ---
  const dup = scoreDuplicateRisk(prospectiveItem, itemDna, wardrobe, lowUseIds);
  const gap = scoreGapFillValue(input.item, input.health);
  const outfit = scoreOutfitCompatibility({ item: prospectiveItem, dna: itemDna }, wardrobe);
  const usage = scoreUsageProjection(input.item, input.usage);
  const cost = scoreCostEfficiency(input.item, usage.projectedWears);
  const healthImpact = scoreWardrobeHealthImpact(itemDna, input.item, input.health);
  const practicality = scorePracticality(itemDna);
  const preference = scorePreferenceFit(input.item, itemDna, input.preferences);

  const breakdown: BuyVsSkipBreakdown = {
    duplicateRisk: dup.dim,
    gapFillValue: gap.dim,
    outfitCompatibility: outfit.dim,
    usageProjection: usage.dim,
    costEfficiency: cost.dim,
    wardrobeHealthImpact: healthImpact.dim,
    practicality: practicality.dim,
    preferenceFit: preference.dim,
  };

  [dup.codes, gap.codes, outfit.codes, usage.codes, cost.codes, healthImpact.codes, practicality.codes, preference.codes]
    .flat()
    .forEach((c) => codes.add(c));

  // --- composite score ---
  let composite01 = 0;
  const byDimensionConfidence = {} as Record<DimensionKey, number>;
  (Object.keys(DIMENSION_WEIGHTS) as DimensionKey[]).forEach((key) => {
    const dim = breakdown[key];
    const contribution = INVERSE_DIMENSIONS.has(key) ? (10 - dim.score) / 10 : dim.score / 10;
    composite01 += DIMENSION_WEIGHTS[key] * contribution;
    byDimensionConfidence[key] = dim.confidence;
    trace.push({
      step: `dimension:${key}`,
      detail: `${dim.score}/10 (conf ${dim.confidence}) — ${dim.reason}`,
      value: dim.score,
    });
  });
  const score = Math.round(clamp(composite01, 0, 1) * 100);
  trace.push({ step: "composite", detail: "weighted composite buy score", value: score });

  // --- confidence (weight-mean over dimensions with confidence > 0) ---
  let confWeightSum = 0;
  let confAccum = 0;
  const confNotes: string[] = [];
  (Object.keys(DIMENSION_WEIGHTS) as DimensionKey[]).forEach((key) => {
    const c = breakdown[key].confidence;
    if (c > 0) {
      confWeightSum += DIMENSION_WEIGHTS[key];
      confAccum += DIMENSION_WEIGHTS[key] * c;
    } else {
      confNotes.push(`${key} had no supporting data`);
    }
  });
  const rawConfidence = confWeightSum > 0 ? confAccum / confWeightSum : 0.2;

  // Scale confidence by how complete the inputs are: sparse item fields + no
  // analytics ⇒ genuinely low confidence (never a confident "buy").
  const filledFields = [
    input.item.color,
    input.item.subcategory,
    input.item.brand,
    input.item.material,
    input.item.formality,
    input.item.estimatedPrice != null ? "price" : null,
    input.item.styleTags?.length ? "styles" : null,
    input.item.intendedOccasions?.length ? "occasions" : null,
  ].filter(Boolean).length;
  const fieldCompleteness = filledFields / 8;
  const dataCompleteness = ((input.health ? 1 : 0) + (input.usage ? 1 : 0)) / 2;
  // Item detail matters more than analytics for a purchase verdict, and a very
  // sparse item (barely any fields) is genuinely low-confidence regardless of
  // how much wardrobe analytics we have.
  const completeness = 0.6 * fieldCompleteness + 0.4 * dataCompleteness;
  let confidence = round1(rawConfidence * (0.4 + 0.6 * completeness));
  if (fieldCompleteness < 0.25) confidence = Math.min(confidence, 0.3);
  if (fieldCompleteness < 0.4)
    confNotes.push("Add more item detail (color, price, material, tags) for a stronger verdict.");

  // --- wardrobe impact score (gap + health − duplication) ---
  const wardrobeImpactScore = Math.round(
    clamp(
      0.45 * (gap.dim.score / 10) +
        0.35 * (healthImpact.dim.score / 10) +
        0.2 * (1 - dup.dim.score / 10),
      0,
      1,
    ) * 100,
  );

  // --- decision + guards ---
  let decision: BuyDecision =
    score >= DECISION_THRESHOLDS.buy ? "buy" : score >= DECISION_THRESHOLDS.consider ? "consider" : "skip";
  trace.push({ step: "threshold", detail: `initial decision from score ${score}: ${decision}` });

  if (dup.dim.score >= GUARDS.duplicateCap) {
    if (dup.lowUseDuplicate) {
      decision = "skip";
      trace.push({ step: "guard:duplicate", detail: "high duplicate risk + low-use duplicates → skip" });
    } else if (decision === "buy") {
      decision = "consider";
      trace.push({ step: "guard:duplicate", detail: "high duplicate risk → capped at consider" });
    }
    codes.add("GUARD_DUPLICATE_CAP");
  }

  if (confidence < GUARDS.sparseConfidence) {
    codes.add("SPARSE_INPUT");
    codes.add("LOW_CONFIDENCE");
    confNotes.push("Sparse input — add price, material, and tags for a stronger verdict.");
  }
  if (confidence < GUARDS.minBuyConfidence && decision === "buy") {
    decision = "consider";
    codes.add("GUARD_LOW_CONFIDENCE");
    trace.push({ step: "guard:confidence", detail: "confidence below buy threshold → consider" });
  }

  codes.add(decision === "buy" ? "DECISION_BUY" : decision === "consider" ? "DECISION_CONSIDER" : "DECISION_SKIP");

  // --- narrative (deterministic from dimensions/codes) ---
  const reasonsToBuy: string[] = [];
  const reasonsToSkip: string[] = [];
  const tradeoffs: string[] = [];
  if (gap.dim.score >= 8) reasonsToBuy.push(gap.dim.reason);
  if (outfit.dim.score >= GUARDS.highQualityOutfit) reasonsToBuy.push(outfit.dim.reason);
  if (usage.dim.score >= 7) reasonsToBuy.push(usage.dim.reason);
  if (cost.dim.score >= 6 && cost.costPerWear != null) reasonsToBuy.push(cost.dim.reason);
  if (healthImpact.dim.score >= 7) reasonsToBuy.push(healthImpact.dim.reason);
  if (preference.dim.score >= 7) reasonsToBuy.push(preference.dim.reason);

  if (dup.dim.score >= GUARDS.duplicateCap) reasonsToSkip.push(dup.dim.reason);
  if (gap.dim.score <= 3) reasonsToSkip.push(gap.dim.reason);
  if (outfit.dim.score < 5) reasonsToSkip.push(outfit.dim.reason);
  if (codes.has("USAGE_RARE_CATEGORY")) reasonsToSkip.push(usage.dim.reason);
  if (cost.dim.score < 4 && cost.costPerWear != null) reasonsToSkip.push(cost.dim.reason);
  if (codes.has("HEALTH_WORSENS")) reasonsToSkip.push(healthImpact.dim.reason);
  if (codes.has("OVER_FORMAL")) reasonsToSkip.push(preference.dim.reason);

  if (dup.dim.score >= 5 && dup.dim.score < GUARDS.duplicateCap)
    tradeoffs.push("Some overlap with what you own, but not a strict duplicate.");
  if (cost.dim.confidence === 0) tradeoffs.push("No price given — cost-per-wear is an estimate.");
  if (codes.has("PRACTICAL_FRAGILE")) tradeoffs.push(practicality.dim.reason);

  const suggestedAlternatives: string[] = [];
  if (dup.dim.score >= GUARDS.duplicateCap && dup.similar.length > 0)
    suggestedAlternatives.push(
      `You already own similar pieces (e.g. "${dup.similar[0].name}") — try wearing those more first.`,
    );
  if (codes.has("OVER_FORMAL"))
    suggestedAlternatives.push("A smart-casual version would likely see more wear in your rotation.");
  if (codes.has("USAGE_RARE_CATEGORY"))
    suggestedAlternatives.push("Consider a more versatile category you actually reach for.");

  const summary = buildSummary(decision, score, input.item, { gap, dup, outfit });

  return {
    decision,
    score,
    confidence,
    confidenceBreakdown: { overall: confidence, byDimension: byDimensionConfidence, notes: confNotes },
    summary,
    scoreBreakdown: breakdown,
    reasonsToBuy,
    reasonsToSkip,
    tradeoffs,
    suggestedAlternatives,
    similarExistingItems: dup.similar,
    potentialOutfits: outfit.potential,
    estimatedCostPerWear: cost.costPerWear,
    wardrobeImpactScore,
    decisionTrace: trace,
    explainabilityCodes: [...codes],
    metadata: {
      engineVersion: BUY_VS_SKIP_ENGINE_VERSION,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      inputSource: input.inputSource ?? "manual",
      contributingEngines: {
        buyVsSkip: BUY_VS_SKIP_ENGINE_VERSION,
        styleDNA: STYLE_DNA_VERSION,
        outfit: OUTFIT_ENGINE_VERSION,
        wardrobeHealth: input.health ? "1.0.0" : null,
        usageAnalytics: input.usage ? "1.0.0" : null,
      },
    },
  };
}

function buildSummary(
  decision: BuyDecision,
  score: number,
  item: ProspectiveItem,
  parts: {
    gap: { dim: DecisionDimension };
    dup: { dim: DecisionDimension };
    outfit: { dim: DecisionDimension };
  },
): string {
  const verb = decision === "buy" ? "Buy" : decision === "consider" ? "Consider" : "Skip";
  if (decision === "buy") {
    return `${verb} — "${item.name}" scores ${score}/100. It fills a real need and works with what you own.`;
  }
  if (decision === "skip") {
    const why =
      parts.dup.dim.score >= GUARDS.duplicateCap
        ? "you already own close alternatives"
        : parts.gap.dim.score <= 3
          ? "it doesn't fill a current gap"
          : "the fit with your wardrobe is weak";
    return `${verb} — "${item.name}" scores ${score}/100; ${why}.`;
  }
  return `${verb} — "${item.name}" scores ${score}/100. Worthwhile only if you have a specific use in mind.`;
}
