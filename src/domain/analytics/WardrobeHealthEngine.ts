/**
 * Wardrobe Health Engine — pure, deterministic analysis of a wardrobe.
 *
 * No React, no Supabase, no AI. Calibrated for the owner's actual profile: a
 * WFH software engineer in Delhi NCR with a smart-casual wardrobe, occasional
 * Gurgaon office days, a metro commute, and rare formal events. The rules
 * therefore reward a strong smart-casual rotation, weight office/smart-casual
 * occasions heavily, keep formalwear low-stakes, and treat Delhi's summer-heavy
 * climate as the dominant season rather than requiring a large winter wardrobe.
 */

import type {
  FormalityEnum,
  ItemStatus,
  UsageFrequency,
} from "@/types/wardrobe";

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
   * Optional descriptive facets. Used for occasion/season coverage, duplicate
   * detection, gap analysis, and the debug report. Left optional so callers
   * that only score need not supply them.
   */
  subcategory?: string | null;
  usage?: UsageFrequency | null;
  /** 0–10 quality rating (the app's scale), or null when unrated. */
  rating?: number | null;
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

/** Lifestyle occasions, weighted by how much they matter to this wardrobe. */
export type OccasionContext =
  | "officeDaily"
  | "smartCasual"
  | "travel"
  | "social"
  | "formal"
  | "gym"
  | "home";

/** Seasons, weighted for a summer-heavy Delhi NCR climate. */
export type SeasonContext = "summer" | "transitional" | "winter";

export type DuplicateSeverity = "watch" | "excess";

export type DuplicateAnalysis = {
  bucket: CategoryBucket;
  colorFamily: string;
  formality: string;
  label: string;
  count: number;
  /** How many pieces in the cluster are rarely worn or low-rated. */
  lowValueCount: number;
  severity: DuplicateSeverity;
};

export type GapPriority = "high" | "medium" | "low";

export type GapAnalysis = {
  label: string;
  kind: "staple" | "category";
  detail: string;
  priority: GapPriority;
};

export type WardrobeHealth = {
  overallScore: number;
  categoryScores: Record<CategoryBucket, number>;
  occasions: Record<OccasionContext, number>;
  seasons: Record<SeasonContext, number>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  duplicates: DuplicateAnalysis[];
  gaps: GapAnalysis[];
};

// ---------------------------------------------------------------------------
// Debug report — a transparent trace of the numbers behind the health report.
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
  /** Relative weight in its family's average (1 for un-weighted families). */
  weight: number;
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
  occasionScores: ScoreBreakdown[];
  seasonScores: ScoreBreakdown[];
  overall: ScoreBreakdown;
  warnings: DebugWarning[];
};

// ---------------------------------------------------------------------------
// Calibration constants — the tunable heart of the engine.
// ---------------------------------------------------------------------------

/**
 * Healthy count range per category. A category scores 100 while its count sits
 * inside the range, ramps up linearly below `min`, and tapers gently (never
 * below 80) above `max` so a deep, useful category is never punished hard.
 */
const CATEGORY_RANGES: Record<CategoryBucket, { min: number; max: number }> = {
  tops: { min: 30, max: 55 },
  bottoms: { min: 12, max: 25 },
  footwear: { min: 8, max: 18 },
  outerwear: { min: 5, max: 12 },
  accessories: { min: 8, max: 25 },
  fragrance: { min: 4, max: 12 },
};

const CATEGORY_BUCKETS: CategoryBucket[] = [
  "tops",
  "bottoms",
  "footwear",
  "outerwear",
  "accessories",
  "fragrance",
];

const CATEGORY_LABELS: Record<CategoryBucket, string> = {
  tops: "tops",
  bottoms: "bottoms",
  footwear: "footwear",
  outerwear: "outerwear",
  accessories: "accessories",
  fragrance: "fragrance",
};

/** Family blend for the overall score. Occasion fit dominates; category depth
 *  and season fit round it out. Formal readiness lives inside occasions at a
 *  deliberately low weight, so a formal-light wardrobe is barely affected. */
const FAMILY_WEIGHTS = {
  category: 0.35,
  occasion: 0.45,
  season: 0.2,
} as const;

/** Points removed per severe (excess) duplicate cluster, capped. Watch-list
 *  clusters cost nothing — they are informational only. */
const DUPLICATE_PENALTY_PER = 3;
const DUPLICATE_PENALTY_MAX = 9;

/** A cluster of this many same-bucket/family/formality pieces is worth a look. */
const DUPLICATE_CLUSTER_MIN = 3;
/** …but only flagged once this many of them are rarely-worn or low-rated. */
const DUPLICATE_LOWVALUE_MIN = 2;
/** …and becomes "excess" (vs "watch") at this many low-value pieces. */
const DUPLICATE_EXCESS_MIN = 3;
/** Ratings run 0–10 here; below this reads as a weak keeper. */
const LOW_RATING_THRESHOLD = 7.5;

/**
 * Coverage scores are composites, not raw counts — abundance alone can't max a
 * score. Each family blends depth (enough options) with quality signals so a
 * broad-but-unworn or thinly-rated wardrobe lands realistically below 100.
 *
 *  - Occasions: can you actually assemble outfits, are the pieces good, worn?
 *  - Seasons: enough well-rated, actively-worn pieces for the season.
 *  - Categories: in a healthy count range, and made of good, worn pieces.
 */
const OCCASION_MIX = { depth: 0.3, completeness: 0.25, quality: 0.25, usage: 0.2 };
const SEASON_MIX = { depth: 0.45, quality: 0.3, usage: 0.25 };
const CATEGORY_MIX = { range: 0.6, quality: 0.25, usage: 0.15 };

/** Neutral quality score when items carry no rating at all (unknown ≠ bad). */
const NEUTRAL_QUALITY = 80;

/** Share of rarely-worn items above which the wardrobe reads as carrying dead weight. */
const RARE_SHARE_WEAKNESS = 0.2;

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

/** Coarse color family, used for duplicate clustering and staple matching. */
export function colorFamilyFor(color: string | null | undefined): string | null {
  const c = normalize(color);
  if (!c || c === "not specified") return null;
  if (["white", "cream", "ivory", "off-white", "ecru"].some((k) => c.includes(k)))
    return "white";
  if (c.includes("black")) return "black";
  if (["charcoal", "grey", "gray", "slate", "graphite"].some((k) => c.includes(k)))
    return "grey";
  if (c.includes("navy")) return "navy";
  if (["blue", "teal", "indigo", "denim"].some((k) => c.includes(k))) return "blue";
  if (["sage", "olive", "green", "mint", "emerald"].some((k) => c.includes(k)))
    return "green";
  if (
    ["beige", "tan", "khaki", "brown", "camel", "taupe", "sand", "stone", "chocolate"].some(
      (k) => c.includes(k),
    )
  )
    return "brown";
  if (["red", "maroon", "burgundy", "wine", "rust"].some((k) => c.includes(k)))
    return "red";
  if (["pink", "rose", "blush"].some((k) => c.includes(k))) return "pink";
  if (["purple", "lavender", "violet"].some((k) => c.includes(k))) return "purple";
  if (["yellow", "mustard", "gold"].some((k) => c.includes(k))) return "yellow";
  if (["orange", "coral", "peach"].some((k) => c.includes(k))) return "orange";
  return c;
}

function tagSet(item: WardrobeHealthItem): Set<string> {
  return new Set((item.tags ?? []).map(normalize));
}
function styleSet(item: WardrobeHealthItem): Set<string> {
  return new Set((item.styles ?? []).map(normalize));
}
function seasonSet(item: WardrobeHealthItem): Set<string> {
  return new Set((item.seasons ?? []).map(normalize));
}
function hasAny(set: Set<string>, values: string[]): boolean {
  return values.some((value) => set.has(value));
}

const BUSINESS_FORMALITY = new Set<FormalityEnum>([
  "smart_casual",
  "business_casual",
  "business_formal",
]);
const FORMAL_FORMALITY = new Set<FormalityEnum>(["formal", "business_formal"]);

function score(raw: number, target: number): number {
  if (target <= 0) return 100;
  return clampScore((raw / target) * 100);
}

// ---------------------------------------------------------------------------
// Quality-signal component scores (0–100). These feed the composites so raw
// abundance alone can never max a score.
// ---------------------------------------------------------------------------

/** Depth: enough options relative to a healthy target (raw abundance, capped). */
function depthScore(count: number, target: number): number {
  return score(count, target);
}

/** Quality: mean 0–10 rating of the set, scaled to 0–100 (neutral if unrated). */
function qualityScore(items: readonly WardrobeHealthItem[]): number {
  const rated = items.filter(
    (item) => item.rating !== null && item.rating !== undefined,
  );
  if (rated.length === 0) return NEUTRAL_QUALITY;
  const avg =
    rated.reduce((sum, item) => sum + (item.rating as number), 0) / rated.length;
  return clampScore(avg * 10);
}

/** Usage: share of the set that is actually worn (not "rare"). */
function activeUsageScore(items: readonly WardrobeHealthItem[]): number {
  if (items.length === 0) return 0;
  const rare = items.filter((item) => item.usage === "rare").length;
  return clampScore((1 - rare / items.length) * 100);
}

/** Completeness: how many outfit slots (top / bottom / footwear) the set fills. */
function outfitCompletenessScore(items: readonly WardrobeHealthItem[]): number {
  const slots: CategoryBucket[] = ["tops", "bottoms", "footwear"];
  const present = slots.filter((slot) =>
    items.some((item) => categoryBucketFor(item.category) === slot),
  ).length;
  return clampScore((present / slots.length) * 100);
}

// ---------------------------------------------------------------------------
// Occasion & season definitions (weighted).
// ---------------------------------------------------------------------------

type OccasionDef = {
  key: OccasionContext;
  label: string;
  weight: number;
  target: number;
  match: (item: WardrobeHealthItem) => boolean;
};

const OCCASION_DEFS: OccasionDef[] = [
  {
    key: "officeDaily",
    label: "Office daily",
    weight: 3,
    target: 12,
    match: (item) =>
      hasAny(tagSet(item), ["office", "leadership", "interview", "reception"]) ||
      hasAny(styleSet(item), ["business casual", "smart casual", "classic", "modern", "minimal"]) ||
      (item.formality !== null && BUSINESS_FORMALITY.has(item.formality)),
  },
  {
    key: "smartCasual",
    label: "Smart casual",
    weight: 3,
    target: 20,
    match: (item) =>
      item.formality === "smart_casual" ||
      hasAny(styleSet(item), [
        "smart casual",
        "modern",
        "classic",
        "minimal",
        "everyday casual",
      ]) ||
      hasAny(tagSet(item), ["casual", "everyday", "versatile", "brunch"]),
  },
  {
    key: "travel",
    label: "Travel",
    weight: 2,
    target: 8,
    match: (item) => hasAny(tagSet(item), ["travel", "vacation"]),
  },
  {
    key: "social",
    label: "Dinner / date / brewery",
    weight: 2,
    target: 8,
    match: (item) =>
      hasAny(tagSet(item), ["dinner", "date", "brewery", "party", "brunch"]),
  },
  {
    key: "formal",
    label: "Wedding / formal",
    weight: 1,
    target: 4,
    match: (item) =>
      hasAny(tagSet(item), ["wedding", "formal", "special occasion", "reception"]) ||
      (item.formality !== null && FORMAL_FORMALITY.has(item.formality)),
  },
  {
    key: "gym",
    label: "Gym",
    weight: 1.5,
    target: 4,
    match: (item) => hasAny(tagSet(item), ["gym"]) || hasAny(styleSet(item), ["athleisure"]),
  },
  {
    key: "home",
    label: "Home / everyday",
    weight: 1.5,
    target: 10,
    match: (item) =>
      hasAny(tagSet(item), ["home", "everyday", "casual"]) ||
      hasAny(styleSet(item), ["everyday casual", "athleisure"]),
  },
];

type SeasonDef = {
  key: SeasonContext;
  label: string;
  weight: number;
  target: number;
  match: (item: WardrobeHealthItem) => boolean;
};

const SEASON_DEFS: SeasonDef[] = [
  {
    key: "summer",
    label: "Summer",
    weight: 3,
    target: 30,
    match: (item) => hasAny(seasonSet(item), ["summer", "year round"]),
  },
  {
    key: "transitional",
    label: "Spring / autumn / monsoon",
    weight: 1.5,
    target: 10,
    match: (item) =>
      hasAny(seasonSet(item), ["spring", "autumn", "fall", "monsoon", "year round"]),
  },
  {
    key: "winter",
    label: "Winter",
    weight: 1,
    target: 12,
    match: (item) => hasAny(seasonSet(item), ["winter", "year round"]),
  },
];

/** Curated smart-casual staples the engine checks for by presence. Absence of
 *  a staple becomes a practical, specific gap recommendation. */
type StapleDef = {
  label: string;
  bucket: CategoryBucket;
  family: string;
  keywords: string[];
  priority: GapPriority;
};

const SMART_CASUAL_STAPLES: StapleDef[] = [
  { label: "Navy knit polo", bucket: "tops", family: "navy", keywords: ["polo"], priority: "high" },
  { label: "Charcoal/grey smart trousers", bucket: "bottoms", family: "grey", keywords: ["trouser", "chino"], priority: "high" },
  { label: "Sage linen shirt", bucket: "tops", family: "green", keywords: ["linen"], priority: "medium" },
  { label: "Medium blue Oxford shirt", bucket: "tops", family: "blue", keywords: ["oxford"], priority: "medium" },
  { label: "Charcoal knit polo", bucket: "tops", family: "grey", keywords: ["polo"], priority: "medium" },
];

function itemMatchesStaple(item: WardrobeHealthItem, staple: StapleDef): boolean {
  if (categoryBucketFor(item.category) !== staple.bucket) return false;
  if (colorFamilyFor(item.color) !== staple.family) return false;
  const haystack = `${normalize(item.name)} ${normalize(item.subcategory)}`;
  return staple.keywords.some((keyword) => haystack.includes(keyword));
}

// ---------------------------------------------------------------------------
// Shared numeric core.
// ---------------------------------------------------------------------------

function categoryRangeScore(count: number, min: number, max: number): number {
  if (count <= 0) return 0;
  if (count < min) return clampScore((count / min) * 100);
  if (count <= max) return 100;
  const over = count - max;
  // Lose up to 20 points as the count grows a full `max` beyond the ceiling.
  return clampScore(100 - (over / max) * 20);
}

type CategoryParts = { count: number; range: number; quality: number; usage: number };
type OccasionParts = {
  matching: number;
  depth: number;
  completeness: number;
  quality: number;
  usage: number;
};
type SeasonParts = { matching: number; depth: number; quality: number; usage: number };

type ScoreContext = {
  active: WardrobeHealthItem[];
  bucketItems: Record<CategoryBucket, WardrobeHealthItem[]>;
  categoryScores: Record<CategoryBucket, number>;
  categoryParts: Record<CategoryBucket, CategoryParts>;
  categoryAvg: number;
  occasions: Record<OccasionContext, number>;
  occasionParts: Record<OccasionContext, OccasionParts>;
  occasionWeighted: number;
  seasons: Record<SeasonContext, number>;
  seasonParts: Record<SeasonContext, SeasonParts>;
  seasonWeighted: number;
  duplicates: DuplicateAnalysis[];
  duplicatePenalty: number;
  gaps: GapAnalysis[];
  distinctColors: number;
  rareCount: number;
  overallScore: number;
};

function weightedAverage(
  entries: { score: number; weight: number }[],
): number {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return 0;
  return (
    entries.reduce((sum, entry) => sum + entry.score * entry.weight, 0) /
    totalWeight
  );
}

function isLowValue(item: WardrobeHealthItem): boolean {
  return (
    item.usage === "rare" ||
    (item.rating !== null && item.rating !== undefined && item.rating < LOW_RATING_THRESHOLD)
  );
}

/** Shared core behind {@link analyzeWardrobeHealth} and {@link buildWardrobeHealthDebug}. */
function computeScoreContext(items: readonly WardrobeHealthItem[]): ScoreContext {
  const active = items.filter(
    (item) => item.status === "active" || item.status === null,
  );

  // ---- Category buckets & range scores ----------------------------------
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

  // Category = healthy count range blended with the quality & usage of its pieces.
  const categoryScores = {} as Record<CategoryBucket, number>;
  const categoryParts = {} as Record<CategoryBucket, CategoryParts>;
  for (const bucket of CATEGORY_BUCKETS) {
    const items = bucketItems[bucket];
    const { min, max } = CATEGORY_RANGES[bucket];
    const range = categoryRangeScore(items.length, min, max);
    const quality = qualityScore(items);
    const usage = activeUsageScore(items);
    categoryParts[bucket] = { count: items.length, range, quality, usage };
    categoryScores[bucket] =
      items.length === 0
        ? 0
        : clampScore(
            range * CATEGORY_MIX.range +
              quality * CATEGORY_MIX.quality +
              usage * CATEGORY_MIX.usage,
          );
  }
  const categoryAvg =
    CATEGORY_BUCKETS.reduce((sum, bucket) => sum + categoryScores[bucket], 0) /
    CATEGORY_BUCKETS.length;

  // Occasion = can you assemble complete outfits, with enough good, worn pieces?
  const occasions = {} as Record<OccasionContext, number>;
  const occasionParts = {} as Record<OccasionContext, OccasionParts>;
  for (const def of OCCASION_DEFS) {
    const matching = active.filter(def.match);
    const depth = depthScore(matching.length, def.target);
    const completeness = outfitCompletenessScore(matching);
    const quality = qualityScore(matching);
    const usage = activeUsageScore(matching);
    occasionParts[def.key] = {
      matching: matching.length,
      depth,
      completeness,
      quality,
      usage,
    };
    occasions[def.key] =
      matching.length === 0
        ? 0
        : clampScore(
            depth * OCCASION_MIX.depth +
              completeness * OCCASION_MIX.completeness +
              quality * OCCASION_MIX.quality +
              usage * OCCASION_MIX.usage,
          );
  }
  const occasionWeighted = weightedAverage(
    OCCASION_DEFS.map((def) => ({ score: occasions[def.key], weight: def.weight })),
  );

  // Season = enough well-rated, actively-worn pieces for the season (Delhi-weighted).
  const seasons = {} as Record<SeasonContext, number>;
  const seasonParts = {} as Record<SeasonContext, SeasonParts>;
  for (const def of SEASON_DEFS) {
    const matching = active.filter(def.match);
    const depth = depthScore(matching.length, def.target);
    const quality = qualityScore(matching);
    const usage = activeUsageScore(matching);
    seasonParts[def.key] = { matching: matching.length, depth, quality, usage };
    seasons[def.key] =
      matching.length === 0
        ? 0
        : clampScore(
            depth * SEASON_MIX.depth +
              quality * SEASON_MIX.quality +
              usage * SEASON_MIX.usage,
          );
  }
  const seasonWeighted = weightedAverage(
    SEASON_DEFS.map((def) => ({ score: seasons[def.key], weight: def.weight })),
  );

  // ---- Duplicate clusters (only when low-value pieces repeat) ------------
  const clusters = new Map<
    string,
    { bucket: CategoryBucket; family: string; formality: string; items: WardrobeHealthItem[] }
  >();
  for (const bucket of CATEGORY_BUCKETS) {
    for (const item of bucketItems[bucket]) {
      const family = colorFamilyFor(item.color);
      if (!family) continue;
      const formality = item.formality ?? "unspecified";
      const key = `${bucket}|${family}|${formality}`;
      const existing = clusters.get(key);
      if (existing) existing.items.push(item);
      else clusters.set(key, { bucket, family, formality, items: [item] });
    }
  }
  const duplicates: DuplicateAnalysis[] = [];
  for (const cluster of clusters.values()) {
    if (cluster.items.length < DUPLICATE_CLUSTER_MIN) continue;
    const lowValueCount = cluster.items.filter(isLowValue).length;
    if (lowValueCount < DUPLICATE_LOWVALUE_MIN) continue;
    let severity: DuplicateSeverity =
      lowValueCount >= DUPLICATE_EXCESS_MIN ? "excess" : "watch";
    // White tops accumulate naturally — keep them on the watch list, never severe.
    if (cluster.bucket === "tops" && cluster.family === "white") severity = "watch";
    duplicates.push({
      bucket: cluster.bucket,
      colorFamily: cluster.family,
      formality: cluster.formality,
      label: `${cluster.items.length} ${cluster.family} ${CATEGORY_LABELS[cluster.bucket]} (${cluster.formality.replace(/_/g, " ")})`,
      count: cluster.items.length,
      lowValueCount,
      severity,
    });
  }
  duplicates.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === "excess" ? -1 : 1) ||
      b.lowValueCount - a.lowValueCount ||
      b.count - a.count,
  );
  const excessCount = duplicates.filter((d) => d.severity === "excess").length;
  const duplicatePenalty = Math.min(
    DUPLICATE_PENALTY_MAX,
    excessCount * DUPLICATE_PENALTY_PER,
  );

  // ---- Gaps: practical staples + genuinely thin categories --------------
  const gaps: GapAnalysis[] = [];
  for (const bucket of CATEGORY_BUCKETS) {
    const count = bucketItems[bucket].length;
    const { min } = CATEGORY_RANGES[bucket];
    if (count < min) {
      gaps.push({
        label: CATEGORY_LABELS[bucket],
        kind: "category",
        detail: `${count} of ${min} recommended minimum`,
        priority: "high",
      });
    }
  }
  for (const staple of SMART_CASUAL_STAPLES) {
    const present = active.some((item) => itemMatchesStaple(item, staple));
    if (!present) {
      gaps.push({
        label: staple.label,
        kind: "staple",
        detail: "Missing smart-casual staple for the daily rotation.",
        priority: staple.priority,
      });
    }
  }
  const priorityRank: Record<GapPriority, number> = { high: 0, medium: 1, low: 2 };
  gaps.sort(
    (a, b) =>
      priorityRank[a.priority] - priorityRank[b.priority] ||
      (a.kind === b.kind ? 0 : a.kind === "category" ? -1 : 1),
  );

  const distinctColors = new Set(
    active.map((item) => normalize(item.color)).filter(Boolean),
  ).size;
  const rareCount = active.filter((item) => item.usage === "rare").length;

  // ---- Overall (weighted family blend, mild duplicate penalty) ----------
  const overall =
    categoryAvg * FAMILY_WEIGHTS.category +
    occasionWeighted * FAMILY_WEIGHTS.occasion +
    seasonWeighted * FAMILY_WEIGHTS.season -
    duplicatePenalty;

  return {
    active,
    bucketItems,
    categoryScores,
    categoryParts,
    categoryAvg,
    occasions,
    occasionParts,
    occasionWeighted,
    seasons,
    seasonParts,
    seasonWeighted,
    duplicates,
    duplicatePenalty,
    gaps,
    distinctColors,
    rareCount,
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

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  for (const bucket of CATEGORY_BUCKETS) {
    if (ctx.categoryScores[bucket] >= 90) {
      strengths.push(`Strong ${CATEGORY_LABELS[bucket]} coverage.`);
    }
  }
  for (const def of OCCASION_DEFS) {
    if (def.weight >= 2 && ctx.occasions[def.key] >= 80) {
      strengths.push(`Well covered for ${def.label.toLowerCase()}.`);
    }
  }
  if (ctx.seasons.summer >= 80) {
    strengths.push("Well suited to Delhi summers.");
  }
  if (ctx.distinctColors >= 8) {
    strengths.push("Diverse color palette.");
  }

  for (const gap of ctx.gaps) {
    if (gap.kind === "category") {
      weaknesses.push(`Underrepresented ${gap.label} (${gap.detail}).`);
    }
  }
  for (const def of OCCASION_DEFS) {
    if (def.weight >= 2 && ctx.occasions[def.key] < 50) {
      weaknesses.push(`Limited ${def.label.toLowerCase()} coverage.`);
    }
  }
  for (const duplicate of ctx.duplicates) {
    if (duplicate.severity === "excess") {
      weaknesses.push(
        `Excess low-use pieces: ${duplicate.label} (${duplicate.lowValueCount} rarely worn).`,
      );
    }
  }
  if (
    ctx.active.length > 0 &&
    ctx.rareCount / ctx.active.length >= RARE_SHARE_WEAKNESS
  ) {
    const pct = Math.round((ctx.rareCount / ctx.active.length) * 100);
    weaknesses.push(
      `${ctx.rareCount} pieces (${pct}%) are rarely worn — dragging usage efficiency.`,
    );
  }

  for (const gap of ctx.gaps) {
    recommendations.push(
      gap.kind === "staple"
        ? `Add a ${gap.label.toLowerCase()}.`
        : `Build up ${gap.label} — ${gap.detail}.`,
    );
  }
  for (const duplicate of ctx.duplicates) {
    if (duplicate.severity === "watch") {
      recommendations.push(
        `Watch list: ${duplicate.label} — several low-use pieces, pause buying more.`,
      );
    }
  }
  if (ctx.occasions.officeDaily < 50) {
    recommendations.push(
      "Add office-ready smart-casual pieces for Gurgaon office days.",
    );
  }
  if (
    ctx.active.length > 0 &&
    ctx.rareCount / ctx.active.length >= RARE_SHARE_WEAKNESS
  ) {
    recommendations.push(
      `Review the ${ctx.rareCount} rarely-worn pieces — restyle, sell, or retire to lift efficiency.`,
    );
  }

  return {
    overallScore: ctx.overallScore,
    categoryScores: ctx.categoryScores,
    occasions: ctx.occasions,
    seasons: ctx.seasons,
    strengths,
    weaknesses,
    recommendations,
    duplicates: ctx.duplicates,
    gaps: ctx.gaps,
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
 * distributions, per-score derivations (with weights), and data-quality
 * warnings. Pure — the UI only renders what this returns. Shares
 * {@link computeScoreContext} with {@link analyzeWardrobeHealth}, so the traced
 * numbers match the report exactly.
 */
export function buildWardrobeHealthDebug(
  items: readonly WardrobeHealthItem[],
): WardrobeHealthDebug {
  const ctx = computeScoreContext(items);
  const { active } = ctx;

  const distributions: DebugDistribution[] = [
    distribution("category", "By category", tallySingle(active, (i) => i.category)),
    distribution("subcategory", "By subcategory", tallySingle(active, (i) => i.subcategory)),
    distribution("usage", "By usage", tallySingle(active, (i) => i.usage)),
    distribution("formality", "By formality", tallySingle(active, (i) => i.formality)),
    distribution("color", "By primary color", tallySingle(active, (i) => i.color)),
    distribution("season", "By season", tallyMulti(active, (i) => i.seasons)),
    distribution("tag", "By tag", tallyMulti(active, (i) => i.tags)),
    distribution("style", "By style", tallyMulti(active, (i) => i.styles)),
  ];

  const categoryScores: ScoreBreakdown[] = CATEGORY_BUCKETS.map((bucket) => {
    const parts = ctx.categoryParts[bucket];
    const { min, max } = CATEGORY_RANGES[bucket];
    return {
      key: bucket,
      label: CATEGORY_LABELS[bucket],
      score: ctx.categoryScores[bucket],
      weight: 1,
      inputs: [
        { label: "Items in bucket", value: parts.count },
        { label: "Healthy range", value: `${min}–${max}` },
      ],
      formula: `range × ${CATEGORY_MIX.range} + quality × ${CATEGORY_MIX.quality} + usage × ${CATEGORY_MIX.usage}`,
      components: [
        { label: "Range fit", value: parts.range },
        { label: "Quality (avg rating)", value: parts.quality },
        { label: "Active usage", value: parts.usage },
        { label: "Score", value: ctx.categoryScores[bucket] },
      ],
    };
  });

  const occasionScores: ScoreBreakdown[] = OCCASION_DEFS.map((def) => {
    const parts = ctx.occasionParts[def.key];
    return {
      key: def.key,
      label: def.label,
      score: ctx.occasions[def.key],
      weight: def.weight,
      inputs: [
        { label: "Matching items", value: parts.matching },
        { label: "Depth target", value: def.target },
        { label: "Importance weight", value: def.weight },
      ],
      formula: `depth × ${OCCASION_MIX.depth} + completeness × ${OCCASION_MIX.completeness} + quality × ${OCCASION_MIX.quality} + usage × ${OCCASION_MIX.usage}`,
      components: [
        { label: "Depth", value: parts.depth },
        { label: "Outfit completeness", value: parts.completeness },
        { label: "Quality", value: parts.quality },
        { label: "Active usage", value: parts.usage },
        { label: "Score", value: ctx.occasions[def.key] },
        { label: "Weighted contribution", value: Math.round(ctx.occasions[def.key] * def.weight) },
      ],
    };
  });

  const seasonScores: ScoreBreakdown[] = SEASON_DEFS.map((def) => {
    const parts = ctx.seasonParts[def.key];
    return {
      key: def.key,
      label: def.label,
      score: ctx.seasons[def.key],
      weight: def.weight,
      inputs: [
        { label: "Matching items", value: parts.matching },
        { label: "Depth target", value: def.target },
        { label: "Importance weight", value: def.weight },
      ],
      formula: `depth × ${SEASON_MIX.depth} + quality × ${SEASON_MIX.quality} + usage × ${SEASON_MIX.usage}`,
      components: [
        { label: "Depth", value: parts.depth },
        { label: "Quality", value: parts.quality },
        { label: "Active usage", value: parts.usage },
        { label: "Score", value: ctx.seasons[def.key] },
        { label: "Weighted contribution", value: Math.round(ctx.seasons[def.key] * def.weight) },
      ],
    };
  });

  const round1 = (value: number) => Math.round(value * 10) / 10;
  const overall: ScoreBreakdown = {
    key: "overall",
    label: "Overall health",
    score: ctx.overallScore,
    weight: 1,
    inputs: [
      { label: "Category average", value: round1(ctx.categoryAvg) },
      { label: "Occasion (weighted)", value: round1(ctx.occasionWeighted) },
      { label: "Season (weighted)", value: round1(ctx.seasonWeighted) },
      { label: "Excess duplicate clusters", value: ctx.duplicates.filter((d) => d.severity === "excess").length },
    ],
    formula: `category × ${FAMILY_WEIGHTS.category} + occasion × ${FAMILY_WEIGHTS.occasion} + season × ${FAMILY_WEIGHTS.season} − duplicate penalty`,
    components: [
      { label: `Category × ${FAMILY_WEIGHTS.category}`, value: round1(ctx.categoryAvg * FAMILY_WEIGHTS.category) },
      { label: `Occasion × ${FAMILY_WEIGHTS.occasion}`, value: round1(ctx.occasionWeighted * FAMILY_WEIGHTS.occasion) },
      { label: `Season × ${FAMILY_WEIGHTS.season}`, value: round1(ctx.seasonWeighted * FAMILY_WEIGHTS.season) },
      { label: "Duplicate penalty", value: -ctx.duplicatePenalty },
      { label: "Final (clamped 0–100)", value: ctx.overallScore },
    ],
  };

  const warnings: DebugWarning[] = [
    warning("missing-category", "Missing category", active, (i) => !normalize(i.category)),
    warning("missing-subcategory", "Missing subcategory", active, (i) => !normalize(i.subcategory)),
    warning("missing-color", "Missing primary color", active, (i) => !normalize(i.color)),
    warning("missing-season", "Missing season", active, (i) => (i.seasons ?? []).filter((s) => s.trim()).length === 0),
    warning("missing-style", "Missing style", active, (i) => (i.styles ?? []).filter((s) => s.trim()).length === 0),
    warning("missing-tags", "Missing tags", active, (i) => (i.tags ?? []).filter((t) => t.trim()).length === 0),
    warning("unbranded", 'Generic brand ("Unbranded")', active, (i) => normalize(i.brand) === "unbranded"),
    warning("unspecified-color", 'Primary color "Not Specified"', active, (i) => normalize(i.color) === "not specified"),
  ].filter((entry) => entry.count > 0);

  return {
    totalActiveItems: active.length,
    totalItems: items.length,
    distributions,
    categoryScores,
    occasionScores,
    seasonScores,
    overall,
    warnings,
  };
}
