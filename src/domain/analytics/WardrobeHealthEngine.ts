/**
 * Wardrobe Health Engine — pure, deterministic analysis of a wardrobe.
 *
 * No React, no Supabase, no AI. Given the active items it derives category
 * balance, occasion/season coverage, duplicates, gaps, and human-readable
 * strengths / weaknesses / recommendations.
 */

import type { FormalityEnum, ItemStatus } from "@/types/wardrobe";

/** Minimal item shape the engine needs (a structural subset of WardrobeItemRow). */
export type WardrobeHealthItem = {
  id: string;
  name: string;
  category: string | null;
  color: string | null;
  brand: string | null;
  formality: FormalityEnum | null;
  status: ItemStatus | null;
};

export type CategoryBucket =
  | "tops"
  | "bottoms"
  | "footwear"
  | "outerwear"
  | "accessories"
  | "fragrance";

export type CoverageContext =
  | "office"
  | "travel"
  | "wedding"
  | "gym"
  | "vacation"
  | "winter"
  | "summer";

export type DuplicateAnalysis = {
  type: "color" | "category";
  label: string;
  count: number;
};

export type GapAnalysis = {
  category: CategoryBucket;
  current: number;
  recommended: number;
};

export type WardrobeHealth = {
  overallScore: number;
  categoryScores: Record<CategoryBucket, number>;
  coverage: Record<CoverageContext, number>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  duplicates: DuplicateAnalysis[];
  gaps: GapAnalysis[];
};

/** Recommended minimum count per bucket for a functional wardrobe. */
const CATEGORY_TARGETS: Record<CategoryBucket, number> = {
  tops: 8,
  bottoms: 5,
  footwear: 4,
  outerwear: 3,
  accessories: 4,
  fragrance: 2,
};

const CATEGORY_BUCKETS: CategoryBucket[] = [
  "tops",
  "bottoms",
  "footwear",
  "outerwear",
  "accessories",
  "fragrance",
];

const COVERAGE_CONTEXTS: CoverageContext[] = [
  "office",
  "travel",
  "wedding",
  "gym",
  "vacation",
  "winter",
  "summer",
];

const CATEGORY_LABELS: Record<CategoryBucket, string> = {
  tops: "tops",
  bottoms: "bottoms",
  footwear: "footwear",
  outerwear: "outerwear",
  accessories: "accessories",
  fragrance: "fragrance",
};

/** Count of duplicate items (same bucket + color) before it reads as excess. */
const COLOR_DUPLICATE_THRESHOLD = 4;

/** A single brand above this share of the wardrobe reads as over-concentration. */
const BRAND_CONCENTRATION_THRESHOLD = 0.4;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Maps a raw category name onto a health bucket (null when unmappable). */
export function categoryBucketFor(category: string | null): CategoryBucket | null {
  const name = normalize(category);
  if (!name) return null;
  if (["top", "shirt", "t-shirt", "tshirt", "polo", "sweater", "knitwear"].some((k) => name.includes(k)))
    return "tops";
  if (["bottom", "trouser", "pant", "jean", "chino", "short", "skirt"].some((k) => name.includes(k)))
    return "bottoms";
  if (["footwear", "shoe", "sneaker", "boot", "loafer", "sandal"].some((k) => name.includes(k)))
    return "footwear";
  if (["outerwear", "jacket", "coat", "blazer", "overcoat"].some((k) => name.includes(k)))
    return "outerwear";
  if (["fragrance", "perfume", "cologne", "scent"].some((k) => name.includes(k)))
    return "fragrance";
  if (["accessory", "belt", "watch", "bag", "hat", "cap", "tie", "scarf", "sunglass", "jewel"].some((k) => name.includes(k)))
    return "accessories";
  return null;
}

const FORMAL_LEVELS = new Set<FormalityEnum>(["formal", "business_formal"]);
const BUSINESS_LEVELS = new Set<FormalityEnum>([
  "smart_casual",
  "business_casual",
  "business_formal",
  "formal",
]);
const CASUAL_LEVELS = new Set<FormalityEnum>(["casual", "smart_casual"]);

function coverageScore(count: number, target: number): number {
  if (target <= 0) return 100;
  return clampScore((count / target) * 100);
}

/**
 * Produces a deterministic {@link WardrobeHealth} report for the given items.
 * Retired/returned items are excluded so the report reflects the usable wardrobe.
 */
export function analyzeWardrobeHealth(
  items: readonly WardrobeHealthItem[],
): WardrobeHealth {
  const active = items.filter(
    (item) => item.status === "active" || item.status === null,
  );

  // ---- Category buckets -------------------------------------------------
  const bucketItems: Record<CategoryBucket, WardrobeHealthItem[]> = {
    tops: [],
    bottoms: [],
    footwear: [],
    outerwear: [],
    accessories: [],
    fragrance: [],
  };
  for (const item of active) {
    const bucket = categoryBucketFor(item.category);
    if (bucket) bucketItems[bucket].push(item);
  }

  const categoryScores = {} as Record<CategoryBucket, number>;
  for (const bucket of CATEGORY_BUCKETS) {
    categoryScores[bucket] = coverageScore(
      bucketItems[bucket].length,
      CATEGORY_TARGETS[bucket],
    );
  }

  // ---- Formality tallies (drive coverage) -------------------------------
  const businessCore = active.filter(
    (item) =>
      item.formality &&
      BUSINESS_LEVELS.has(item.formality) &&
      ["tops", "bottoms", "footwear"].includes(
        categoryBucketFor(item.category) ?? "",
      ),
  ).length;
  const formalCount = active.filter(
    (item) => item.formality && FORMAL_LEVELS.has(item.formality),
  ).length;
  const casualCount = active.filter(
    (item) => item.formality && CASUAL_LEVELS.has(item.formality),
  ).length;
  const filledBuckets = CATEGORY_BUCKETS.filter(
    (bucket) => bucketItems[bucket].length >= CATEGORY_TARGETS[bucket] / 2,
  ).length;
  const casualTopsBottoms = active.filter(
    (item) =>
      item.formality &&
      CASUAL_LEVELS.has(item.formality) &&
      ["tops", "bottoms"].includes(categoryBucketFor(item.category) ?? ""),
  ).length;

  const coverage: Record<CoverageContext, number> = {
    office: coverageScore(businessCore, 6),
    travel: coverageScore(filledBuckets, CATEGORY_BUCKETS.length),
    wedding: coverageScore(formalCount, 3),
    gym: coverageScore(casualCount, 4),
    vacation: coverageScore(casualCount, 6),
    winter: coverageScore(bucketItems.outerwear.length, CATEGORY_TARGETS.outerwear),
    summer: coverageScore(casualTopsBottoms, 6),
  };

  // ---- Duplicates -------------------------------------------------------
  const duplicates: DuplicateAnalysis[] = [];

  const colorGroups = new Map<string, { count: number; color: string; bucket: CategoryBucket }>();
  for (const bucket of CATEGORY_BUCKETS) {
    for (const item of bucketItems[bucket]) {
      const color = normalize(item.color);
      if (!color) continue;
      const key = `${bucket}::${color}`;
      const existing = colorGroups.get(key);
      if (existing) existing.count += 1;
      else colorGroups.set(key, { count: 1, color: item.color ?? color, bucket });
    }
  }
  for (const group of colorGroups.values()) {
    if (group.count >= COLOR_DUPLICATE_THRESHOLD) {
      duplicates.push({
        type: "color",
        label: `${group.count} ${group.color} ${CATEGORY_LABELS[group.bucket]}`,
        count: group.count,
      });
    }
  }

  for (const bucket of CATEGORY_BUCKETS) {
    const count = bucketItems[bucket].length;
    if (count >= CATEGORY_TARGETS[bucket] * 2) {
      duplicates.push({
        type: "category",
        label: `${count} ${CATEGORY_LABELS[bucket]} (well above target)`,
        count,
      });
    }
  }
  duplicates.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // ---- Gaps -------------------------------------------------------------
  const gaps: GapAnalysis[] = CATEGORY_BUCKETS.filter(
    (bucket) => bucketItems[bucket].length < CATEGORY_TARGETS[bucket],
  ).map((bucket) => ({
    category: bucket,
    current: bucketItems[bucket].length,
    recommended: CATEGORY_TARGETS[bucket],
  }));

  // ---- Brand concentration ---------------------------------------------
  const brandCounts = new Map<string, number>();
  for (const item of active) {
    const brand = normalize(item.brand);
    if (!brand || brand === "unbranded") continue;
    brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
  }
  let dominantBrand: { name: string; share: number } | null = null;
  if (active.length > 0) {
    for (const [brand, count] of brandCounts) {
      const share = count / active.length;
      if (!dominantBrand || share > dominantBrand.share) {
        dominantBrand = { name: brand, share };
      }
    }
  }

  const distinctColors = new Set(
    active.map((item) => normalize(item.color)).filter(Boolean),
  ).size;

  // ---- Narrative --------------------------------------------------------
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  for (const bucket of CATEGORY_BUCKETS) {
    if (categoryScores[bucket] >= 100) {
      strengths.push(`Strong ${CATEGORY_LABELS[bucket]} collection.`);
    }
  }
  for (const context of COVERAGE_CONTEXTS) {
    if (coverage[context] >= 80) {
      strengths.push(`Well covered for ${context}.`);
    }
  }
  if (distinctColors >= 8) {
    strengths.push("Diverse color palette.");
  }

  for (const gap of gaps) {
    weaknesses.push(
      `Underrepresented ${CATEGORY_LABELS[gap.category]} (${gap.current}/${gap.recommended}).`,
    );
    recommendations.push(
      `Add ${gap.recommended - gap.current} more ${CATEGORY_LABELS[gap.category]}.`,
    );
  }
  for (const context of COVERAGE_CONTEXTS) {
    if (coverage[context] < 50) {
      weaknesses.push(`Limited ${context} readiness.`);
    }
  }
  if (
    dominantBrand &&
    dominantBrand.share >= BRAND_CONCENTRATION_THRESHOLD &&
    active.length >= 5
  ) {
    weaknesses.push(
      `Over-concentrated in one brand (${Math.round(dominantBrand.share * 100)}%).`,
    );
    recommendations.push("Diversify across more brands.");
  }
  for (const duplicate of duplicates) {
    if (duplicate.type === "color") {
      recommendations.push(`Avoid buying more of: ${duplicate.label}.`);
    }
  }
  if (coverage.office < 50) {
    recommendations.push(
      "Add business-appropriate tops, bottoms, and footwear for office readiness.",
    );
  }

  // ---- Overall score ----------------------------------------------------
  const categoryAvg =
    CATEGORY_BUCKETS.reduce((sum, bucket) => sum + categoryScores[bucket], 0) /
    CATEGORY_BUCKETS.length;
  const coverageAvg =
    COVERAGE_CONTEXTS.reduce((sum, context) => sum + coverage[context], 0) /
    COVERAGE_CONTEXTS.length;

  let overall = categoryAvg * 0.6 + coverageAvg * 0.4;
  if (dominantBrand && dominantBrand.share >= BRAND_CONCENTRATION_THRESHOLD) {
    overall -= 10;
  }
  overall -= Math.min(10, duplicates.length * 2);

  return {
    overallScore: clampScore(overall),
    categoryScores,
    coverage,
    strengths,
    weaknesses,
    recommendations,
    duplicates,
    gaps,
  };
}
