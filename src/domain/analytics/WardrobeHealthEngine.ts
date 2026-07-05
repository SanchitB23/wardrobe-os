/**
 * Wardrobe Health Engine — pure, deterministic analysis of a wardrobe.
 *
 * No React, no Supabase, no AI. Given the active items it derives category
 * balance, occasion/season coverage, duplicates, gaps, and human-readable
 * strengths / weaknesses / recommendations.
 */

import type { FormalityEnum, ItemStatus, UsageFrequency } from "@/types/wardrobe";

/** Minimal item shape the engine needs (a structural subset of WardrobeItemRow). */
export type WardrobeHealthItem = {
  id: string;
  name: string;
  category: string | null;
  color: string | null;
  brand: string | null;
  formality: FormalityEnum | null;
  status: ItemStatus | null;
  /**
   * Optional descriptive facets. The scoring logic ignores these, but the debug
   * report ({@link buildWardrobeHealthDebug}) uses them for distributions and
   * data-quality warnings. Left optional so callers that only score need not
   * supply them.
   */
  subcategory?: string | null;
  usage?: UsageFrequency | null;
  seasons?: string[];
  tags?: string[];
  styles?: string[];
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

// ---------------------------------------------------------------------------
// Debug report — a transparent trace of the numbers behind the health report.
// Everything here is derived by the pure engine so the UI only renders it.
// ---------------------------------------------------------------------------

/** A `label → count` tally with its share of the dimension, sorted for display. */
export type CountBucket = {
  label: string;
  count: number;
  /** Share of the dimension total, rounded to a whole percent. */
  percentage: number;
};

/** A named group of tallies for one dimension (category, usage, season, …). */
export type DebugDistribution = {
  key: string;
  label: string;
  /** Distinct values observed (excluding the synthetic "none" bucket). */
  distinct: number;
  /** Sum of all bucket counts (multi-valued facets can exceed item count). */
  total: number;
  buckets: CountBucket[];
};

/** The full derivation of a single score: what went in, the rule, the result. */
export type ScoreBreakdown = {
  key: string;
  label: string;
  score: number;
  /** Raw inputs the score was computed from. */
  inputs: { label: string; value: string | number }[];
  /** Human-readable formula / weights used. */
  formula: string;
  /** Intermediate values produced along the way. */
  components: { label: string; value: string | number }[];
};

/** A data-quality warning: a rule plus the items that tripped it. */
export type DebugWarning = {
  key: string;
  label: string;
  count: number;
  items: { id: string; name: string }[];
};

export type WardrobeHealthDebug = {
  totalActiveItems: number;
  totalItems: number;
  distributions: DebugDistribution[];
  categoryScores: ScoreBreakdown[];
  coverageScores: ScoreBreakdown[];
  overall: ScoreBreakdown;
  warnings: DebugWarning[];
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

/** Recommended target used to score each coverage context (raw count / target). */
const COVERAGE_TARGETS: Record<CoverageContext, number> = {
  office: 6,
  travel: 6,
  wedding: 3,
  gym: 4,
  vacation: 6,
  winter: CATEGORY_TARGETS.outerwear,
  summer: 6,
};

/** Weights combining the two score families into the overall score. */
const CATEGORY_WEIGHT = 0.6;
const COVERAGE_WEIGHT = 0.4;

/** Points deducted when one brand dominates the wardrobe. */
const BRAND_CONCENTRATION_PENALTY = 10;
/** Points deducted per detected duplicate group, capped. */
const DUPLICATE_PENALTY_PER = 2;
const DUPLICATE_PENALTY_MAX = 10;

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

/** What a coverage context's raw input counts, for the debug trace. */
const COVERAGE_INPUT_LABELS: Record<CoverageContext, string> = {
  office: "Business-appropriate tops/bottoms/footwear",
  travel: "Buckets at least half-filled",
  wedding: "Formal / business-formal items",
  gym: "Casual items",
  vacation: "Casual items",
  winter: "Outerwear items",
  summer: "Casual tops & bottoms",
};

type ScoreContext = {
  active: WardrobeHealthItem[];
  bucketItems: Record<CategoryBucket, WardrobeHealthItem[]>;
  categoryScores: Record<CategoryBucket, number>;
  coverageInputs: Record<CoverageContext, { raw: number; target: number }>;
  coverage: Record<CoverageContext, number>;
  duplicates: DuplicateAnalysis[];
  gaps: GapAnalysis[];
  dominantBrand: { name: string; share: number } | null;
  distinctColors: number;
  categoryAvg: number;
  coverageAvg: number;
  brandPenalty: number;
  duplicatePenalty: number;
  overallScore: number;
};

/**
 * Shared numeric core behind both {@link analyzeWardrobeHealth} and
 * {@link buildWardrobeHealthDebug}. Keeping every score in one place means the
 * debug trace can never drift from the reported numbers.
 */
function computeScoreContext(
  items: readonly WardrobeHealthItem[],
): ScoreContext {
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

  const coverageInputs: Record<CoverageContext, { raw: number; target: number }> = {
    office: { raw: businessCore, target: COVERAGE_TARGETS.office },
    travel: { raw: filledBuckets, target: COVERAGE_TARGETS.travel },
    wedding: { raw: formalCount, target: COVERAGE_TARGETS.wedding },
    gym: { raw: casualCount, target: COVERAGE_TARGETS.gym },
    vacation: { raw: casualCount, target: COVERAGE_TARGETS.vacation },
    winter: { raw: bucketItems.outerwear.length, target: COVERAGE_TARGETS.winter },
    summer: { raw: casualTopsBottoms, target: COVERAGE_TARGETS.summer },
  };

  const coverage = {} as Record<CoverageContext, number>;
  for (const context of COVERAGE_CONTEXTS) {
    coverage[context] = coverageScore(
      coverageInputs[context].raw,
      coverageInputs[context].target,
    );
  }

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

  // ---- Overall score ----------------------------------------------------
  const categoryAvg =
    CATEGORY_BUCKETS.reduce((sum, bucket) => sum + categoryScores[bucket], 0) /
    CATEGORY_BUCKETS.length;
  const coverageAvg =
    COVERAGE_CONTEXTS.reduce((sum, context) => sum + coverage[context], 0) /
    COVERAGE_CONTEXTS.length;

  const brandPenalty =
    dominantBrand && dominantBrand.share >= BRAND_CONCENTRATION_THRESHOLD
      ? BRAND_CONCENTRATION_PENALTY
      : 0;
  const duplicatePenalty = Math.min(
    DUPLICATE_PENALTY_MAX,
    duplicates.length * DUPLICATE_PENALTY_PER,
  );

  const overall =
    categoryAvg * CATEGORY_WEIGHT +
    coverageAvg * COVERAGE_WEIGHT -
    brandPenalty -
    duplicatePenalty;

  return {
    active,
    bucketItems,
    categoryScores,
    coverageInputs,
    coverage,
    duplicates,
    gaps,
    dominantBrand,
    distinctColors,
    categoryAvg,
    coverageAvg,
    brandPenalty,
    duplicatePenalty,
    overallScore: clampScore(overall),
  };
}

/**
 * Produces a deterministic {@link WardrobeHealth} report for the given items.
 * Retired/returned items are excluded so the report reflects the usable wardrobe.
 */
export function analyzeWardrobeHealth(
  items: readonly WardrobeHealthItem[],
): WardrobeHealth {
  const ctx = computeScoreContext(items);
  const {
    active,
    categoryScores,
    coverage,
    duplicates,
    gaps,
    dominantBrand,
    distinctColors,
  } = ctx;

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

  return {
    overallScore: ctx.overallScore,
    categoryScores,
    coverage,
    strengths,
    weaknesses,
    recommendations,
    duplicates,
    gaps,
  };
}

// ---------------------------------------------------------------------------
// Debug report
// ---------------------------------------------------------------------------

/** Label used for items that lack a value in a given dimension. */
const NONE_LABEL = "— none —";

type RawBucket = { label: string; count: number };

type Tally = { buckets: RawBucket[]; distinct: number };

function sortBuckets(buckets: RawBucket[]): RawBucket[] {
  return [...buckets].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}

/** Tallies a single-valued facet, appending a trailing "none" bucket. */
function tallySingle(
  items: readonly WardrobeHealthItem[],
  get: (item: WardrobeHealthItem) => string | null | undefined,
): Tally {
  const counts = new Map<string, number>();
  let none = 0;
  for (const item of items) {
    const raw = (get(item) ?? "").trim();
    if (!raw) {
      none += 1;
      continue;
    }
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  const buckets = sortBuckets(
    Array.from(counts, ([label, count]) => ({ label, count })),
  );
  const distinct = buckets.length;
  if (none > 0) buckets.push({ label: NONE_LABEL, count: none });
  return { buckets, distinct };
}

/** Tallies a multi-valued facet; "none" counts items with no values at all. */
function tallyMulti(
  items: readonly WardrobeHealthItem[],
  get: (item: WardrobeHealthItem) => readonly string[] | undefined,
): Tally {
  const counts = new Map<string, number>();
  let none = 0;
  for (const item of items) {
    const values = (get(item) ?? [])
      .map((value) => value.trim())
      .filter(Boolean);
    if (values.length === 0) {
      none += 1;
      continue;
    }
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  const buckets = sortBuckets(
    Array.from(counts, ([label, count]) => ({ label, count })),
  );
  const distinct = buckets.length;
  if (none > 0) buckets.push({ label: NONE_LABEL, count: none });
  return { buckets, distinct };
}

function distribution(key: string, label: string, tally: Tally): DebugDistribution {
  const total = tally.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const buckets: CountBucket[] = tally.buckets.map((bucket) => ({
    label: bucket.label,
    count: bucket.count,
    percentage: total > 0 ? Math.round((bucket.count / total) * 100) : 0,
  }));
  return { key, label, distinct: tally.distinct, total, buckets };
}

/** Items where `predicate` holds, mapped to the `{ id, name }` warning shape. */
function warning(
  key: string,
  label: string,
  items: readonly WardrobeHealthItem[],
  predicate: (item: WardrobeHealthItem) => boolean,
): DebugWarning {
  const hits = items
    .filter(predicate)
    .map((item) => ({ id: item.id, name: item.name }));
  return { key, label, count: hits.length, items: hits };
}

/**
 * Produces a transparent {@link WardrobeHealthDebug} trace for the given items:
 * distributions, per-score derivations, and data-quality warnings. Pure — the
 * UI only renders what this returns. Shares {@link computeScoreContext} with
 * {@link analyzeWardrobeHealth}, so the traced numbers match the report exactly.
 */
export function buildWardrobeHealthDebug(
  items: readonly WardrobeHealthItem[],
): WardrobeHealthDebug {
  const ctx = computeScoreContext(items);
  const { active } = ctx;

  // ---- Distributions ----------------------------------------------------
  const distributions: DebugDistribution[] = [
    distribution("category", "By category", tallySingle(active, (i) => i.category)),
    distribution(
      "subcategory",
      "By subcategory",
      tallySingle(active, (i) => i.subcategory),
    ),
    distribution("usage", "By usage", tallySingle(active, (i) => i.usage)),
    distribution(
      "formality",
      "By formality",
      tallySingle(active, (i) => i.formality),
    ),
    distribution("color", "By primary color", tallySingle(active, (i) => i.color)),
    distribution("season", "By season", tallyMulti(active, (i) => i.seasons)),
    distribution("tag", "By tag", tallyMulti(active, (i) => i.tags)),
    distribution("style", "By style", tallyMulti(active, (i) => i.styles)),
  ];

  // ---- Category score breakdowns ---------------------------------------
  const categoryScores: ScoreBreakdown[] = CATEGORY_BUCKETS.map((bucket) => {
    const count = ctx.bucketItems[bucket].length;
    const target = CATEGORY_TARGETS[bucket];
    return {
      key: bucket,
      label: CATEGORY_LABELS[bucket],
      score: ctx.categoryScores[bucket],
      inputs: [
        { label: "Items in bucket", value: count },
        { label: "Recommended target", value: target },
      ],
      formula: "round(count / target × 100), clamped 0–100",
      components: [
        { label: "count / target", value: `${count} / ${target}` },
        { label: "Score", value: ctx.categoryScores[bucket] },
      ],
    };
  });

  // ---- Coverage score breakdowns ---------------------------------------
  const coverageScores: ScoreBreakdown[] = COVERAGE_CONTEXTS.map((context) => {
    const { raw, target } = ctx.coverageInputs[context];
    return {
      key: context,
      label: context.charAt(0).toUpperCase() + context.slice(1),
      score: ctx.coverage[context],
      inputs: [
        { label: COVERAGE_INPUT_LABELS[context], value: raw },
        { label: "Target", value: target },
      ],
      formula: "round(input / target × 100), clamped 0–100",
      components: [
        { label: "input / target", value: `${raw} / ${target}` },
        { label: "Score", value: ctx.coverage[context] },
      ],
    };
  });

  // ---- Overall score breakdown -----------------------------------------
  const categoryAvg = Math.round(ctx.categoryAvg * 10) / 10;
  const coverageAvg = Math.round(ctx.coverageAvg * 10) / 10;
  const overall: ScoreBreakdown = {
    key: "overall",
    label: "Overall health",
    score: ctx.overallScore,
    inputs: [
      { label: "Category average", value: categoryAvg },
      { label: "Coverage average", value: coverageAvg },
      {
        label: "Dominant brand",
        value: ctx.dominantBrand
          ? `${ctx.dominantBrand.name} (${Math.round(ctx.dominantBrand.share * 100)}%)`
          : "—",
      },
      { label: "Duplicate groups", value: ctx.duplicates.length },
    ],
    formula: `categoryAvg × ${CATEGORY_WEIGHT} + coverageAvg × ${COVERAGE_WEIGHT} − brand penalty − duplicate penalty`,
    components: [
      {
        label: `Category × ${CATEGORY_WEIGHT}`,
        value: Math.round(ctx.categoryAvg * CATEGORY_WEIGHT * 10) / 10,
      },
      {
        label: `Coverage × ${COVERAGE_WEIGHT}`,
        value: Math.round(ctx.coverageAvg * COVERAGE_WEIGHT * 10) / 10,
      },
      { label: "Brand penalty", value: -ctx.brandPenalty },
      { label: "Duplicate penalty", value: -ctx.duplicatePenalty },
      { label: "Final (clamped 0–100)", value: ctx.overallScore },
    ],
  };

  // ---- Data-quality warnings -------------------------------------------
  const warnings: DebugWarning[] = [
    warning("missing-category", "Missing category", active, (i) => !normalize(i.category)),
    warning(
      "missing-subcategory",
      "Missing subcategory",
      active,
      (i) => !normalize(i.subcategory),
    ),
    warning(
      "missing-color",
      "Missing primary color",
      active,
      (i) => !normalize(i.color),
    ),
    warning(
      "missing-season",
      "Missing season",
      active,
      (i) => (i.seasons ?? []).filter((s) => s.trim()).length === 0,
    ),
    warning(
      "missing-style",
      "Missing style",
      active,
      (i) => (i.styles ?? []).filter((s) => s.trim()).length === 0,
    ),
    warning(
      "missing-tags",
      "Missing tags",
      active,
      (i) => (i.tags ?? []).filter((t) => t.trim()).length === 0,
    ),
    warning(
      "unbranded",
      'Generic brand ("Unbranded")',
      active,
      (i) => normalize(i.brand) === "unbranded",
    ),
    warning(
      "unspecified-color",
      'Primary color "Not Specified"',
      active,
      (i) => normalize(i.color) === "not specified",
    ),
  ].filter((entry) => entry.count > 0);

  return {
    totalActiveItems: active.length,
    totalItems: items.length,
    distributions,
    categoryScores,
    coverageScores,
    overall,
    warnings,
  };
}
