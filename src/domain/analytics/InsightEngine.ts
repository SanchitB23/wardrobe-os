/**
 * Insight Engine — the centralized insight layer for Wardrobe OS.
 *
 * No React, no Supabase, no AI. It combines the outputs of the wardrobe-health,
 * usage, purchase, and outfit analytics engines into a single, deduplicated,
 * priority-ranked set of actionable {@link WardrobeInsight}s. Pure and
 * deterministic: the `createdAt` timestamp is injected so output is stable.
 */

import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type { UsageAnalytics } from "@/domain/analytics/UsageAnalyticsEngine";
import type { PurchaseAnalytics } from "@/types/wardrobe";

/**
 * Wardrobe-level outfit analytics. There is no such aggregate type elsewhere in
 * the codebase (the outfit engine produces a per-outfit `OutfitAnalysis`), so
 * the Insight Center defines the minimal shape it consumes. Optional.
 */
export interface OutfitAnalytics {
  totalOutfits: number;
  /** Mean 0–10 composite outfit score. */
  averageScore: number;
  topOutfits?: { id: string; name: string; score: number }[];
}

export interface InsightContext {
  wardrobeHealth: WardrobeHealth;
  usageAnalytics: UsageAnalytics;
  purchaseAnalytics?: PurchaseAnalytics;
  outfitAnalytics?: OutfitAnalytics;
}

export type InsightType =
  | "strength"
  | "weakness"
  | "opportunity"
  | "warning"
  | "action";

export type InsightPriority = "low" | "medium" | "high" | "critical";

export interface WardrobeInsight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  evidence: string[];
  suggestedActions: string[];
  relatedItemIds?: string[];
  relatedCategory?: string;
  createdAt: string;
}

export interface InsightReport {
  overallSummary: string;
  insights: WardrobeInsight[];
  topActions: WardrobeInsight[];
  warnings: WardrobeInsight[];
  strengths: WardrobeInsight[];
}

export interface InsightOptions {
  /** ISO timestamp stamped onto every insight; inject for deterministic output. */
  generatedAt?: string;
  /** Max number of items in each top-N list. */
  topActionsLimit?: number;
  /**
   * Items the owner has explicitly protected (RFC-004). They are never surfaced
   * as removal/declutter candidates — their ids are stripped from the
   * `relatedItemIds` of removal-flavored insights (never-worn, stale, poor value).
   */
  protectedItemIds?: readonly string[];
}

/** Insight ids that read as "reconsider keeping this item". Protected items are
 *  filtered out of these so a pinned item is never flagged for removal. */
const REMOVAL_FLAVORED_INSIGHT_IDS: ReadonlySet<string> = new Set([
  "never-worn",
  "stale-items",
  "poor-cost-per-wear",
]);

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const PRIORITY_RANK: Record<InsightPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const DEFAULT_TOP_ACTIONS = 5;
const MAX_RELATED_IDS = 20;

/** Health score below this reads as a critical, wardrobe-wide problem. */
const CRITICAL_HEALTH = 60;
/** Occasion score at/above this reads as a genuine strength. */
const STRONG_COVERAGE = 85;
/** A hero piece must have at least this many wears to be worth celebrating. */
const HERO_MIN_WEARS = 3;
/** Cost-per-wear items worn this few times read as poor value. */
const POOR_VALUE_WEARS = 2;
const STRONG_OUTFIT_SCORE = 7.5;
const WEAK_OUTFIT_SCORE = 5;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function names(items: readonly { name: string }[], take = 3): string {
  return items
    .slice(0, take)
    .map((item) => item.name)
    .join(", ");
}

function relatedIds(items: readonly { id: string }[]): string[] {
  return items.slice(0, MAX_RELATED_IDS).map((item) => item.id);
}

// ---------------------------------------------------------------------------
// Collector — merges insights that share an id (deduplication).
// ---------------------------------------------------------------------------

class InsightCollector {
  private readonly map = new Map<string, WardrobeInsight>();

  constructor(private readonly createdAt: string) {}

  add(insight: Omit<WardrobeInsight, "createdAt">): void {
    const existing = this.map.get(insight.id);
    if (!existing) {
      this.map.set(insight.id, { ...insight, createdAt: this.createdAt });
      return;
    }

    // Merge: keep the first (structured) type/title/description, union the
    // supporting detail, and raise to the strongest priority seen.
    existing.evidence = unique([...existing.evidence, ...insight.evidence]);
    existing.suggestedActions = unique([
      ...existing.suggestedActions,
      ...insight.suggestedActions,
    ]);
    if (insight.relatedItemIds || existing.relatedItemIds) {
      existing.relatedItemIds = unique([
        ...(existing.relatedItemIds ?? []),
        ...(insight.relatedItemIds ?? []),
      ]);
    }
    existing.relatedCategory = existing.relatedCategory ?? insight.relatedCategory;
    if (PRIORITY_RANK[insight.priority] > PRIORITY_RANK[existing.priority]) {
      existing.priority = insight.priority;
    }
  }

  values(): WardrobeInsight[] {
    return Array.from(this.map.values());
  }
}

// ---------------------------------------------------------------------------
// Structured generators — derive insights from the analytics' typed fields.
// ---------------------------------------------------------------------------

function generateStructured(ctx: InsightContext, add: InsightCollector["add"]): void {
  const { wardrobeHealth: health, usageAnalytics: usage } = ctx;

  // --- Critical: low overall health -------------------------------------
  if (health.overallScore < CRITICAL_HEALTH) {
    add({
      id: "low-overall-health",
      type: "warning",
      priority: "critical",
      title: `Wardrobe health is low (${health.overallScore}/100)`,
      description:
        "Several dimensions are underperforming at once. Address the highest-priority gaps and coverage issues first.",
      evidence: [`Overall health score ${health.overallScore}/100.`],
      suggestedActions: ["Work through the high-priority gaps and warnings below."],
    });
  }

  // --- Strength: strong office / smart-casual coverage ------------------
  if (health.occasions.officeDaily >= STRONG_COVERAGE) {
    add({
      id: "office-coverage",
      type: "strength",
      priority: "low",
      title: "Strong office-ready coverage",
      description:
        "You can reliably put together office-appropriate outfits.",
      evidence: [`Office daily coverage ${health.occasions.officeDaily}/100.`],
      suggestedActions: [],
    });
  }
  if (health.occasions.smartCasual >= STRONG_COVERAGE) {
    add({
      id: "smart-casual-coverage",
      type: "strength",
      priority: "low",
      title: "Strong smart-casual coverage",
      description: "Your everyday smart-casual rotation is well stocked.",
      evidence: [`Smart-casual coverage ${health.occasions.smartCasual}/100.`],
      suggestedActions: [],
    });
  }

  // --- Strength: high-performing hero pieces ----------------------------
  const heroes = usage.mostWornItems.filter((item) => item.wearCount >= HERO_MIN_WEARS);
  if (heroes.length > 0) {
    add({
      id: "hero-pieces",
      type: "strength",
      priority: "low",
      title: "High-performing hero pieces",
      description: "These pieces do the heavy lifting in your rotation.",
      evidence: heroes
        .slice(0, 3)
        .map((item) => `${item.name}: ${item.wearCount} wears.`),
      suggestedActions: ["Consider backups for your most-relied-on pieces."],
      relatedItemIds: relatedIds(heroes),
    });
  }

  // --- Warning: never-worn items ----------------------------------------
  if (usage.neverWornItems.length > 0) {
    const n = usage.neverWornItems.length;
    add({
      id: "never-worn",
      type: "warning",
      priority: n >= 20 ? "high" : n >= 8 ? "medium" : "low",
      title: `${n} items have never been worn`,
      description:
        "Unworn pieces tie up space and money without earning their place.",
      evidence: [`Never worn, e.g. ${names(usage.neverWornItems)}.`],
      suggestedActions: [
        "Style or rehome never-worn pieces.",
        "Build an outfit around a few of them this week.",
      ],
      relatedItemIds: relatedIds(usage.neverWornItems),
    });
  }

  // --- Warning: stale items ---------------------------------------------
  if (usage.staleItems.length > 0) {
    const n = usage.staleItems.length;
    add({
      id: "stale-items",
      type: "warning",
      priority: n >= 5 ? "high" : "medium",
      title: `${n} items haven't been worn in 90+ days`,
      description: "Once-loved pieces are drifting out of rotation.",
      evidence: [`Stale, e.g. ${names(usage.staleItems)}.`],
      suggestedActions: ["Reintroduce stale favorites into your rotation."],
      relatedItemIds: relatedIds(usage.staleItems),
    });
  }

  // --- Opportunity: underused active pieces -----------------------------
  if (usage.leastWornActiveItems.length > 0) {
    add({
      id: "rotate-underused",
      type: "opportunity",
      priority: "low",
      title: "Underused pieces worth more rotation",
      description: "Active pieces you own but rarely reach for.",
      evidence: [`Underused, e.g. ${names(usage.leastWornActiveItems)}.`],
      suggestedActions: ["Give these pieces intentional wear this month."],
      relatedItemIds: relatedIds(usage.leastWornActiveItems),
    });
  }

  // --- Opportunity: practical wardrobe gaps -----------------------------
  for (const gap of health.gaps) {
    add({
      id: `gap-${slugify(gap.label)}`,
      type: "opportunity",
      priority: gap.priority,
      title:
        gap.kind === "staple"
          ? `Add ${gap.label}`
          : `Build up ${gap.label}`,
      description:
        gap.kind === "staple"
          ? "A practical smart-casual staple missing from your rotation."
          : "This category is below its healthy minimum.",
      evidence: [gap.detail],
      suggestedActions: [
        gap.kind === "staple"
          ? `Add a ${gap.label.toLowerCase()}.`
          : `Add more ${gap.label}.`,
      ],
      relatedCategory: gap.kind === "category" ? gap.label : undefined,
    });
  }

  // --- Weakness: excess low-use duplicate clusters ----------------------
  for (const dup of health.duplicates) {
    if (dup.severity !== "excess") continue;
    add({
      id: `duplicate-${dup.bucket}-${dup.colorFamily}`,
      type: "weakness",
      priority: "medium",
      title: `Excess low-use ${dup.colorFamily} ${dup.bucket}`,
      description:
        "A cluster of similar pieces where several are rarely worn — diminishing returns.",
      evidence: [`${dup.label} · ${dup.lowValueCount} rarely worn.`],
      suggestedActions: [
        `Pause buying more ${dup.colorFamily} ${dup.bucket}.`,
        "Cull or restyle the low-use pieces.",
      ],
      relatedCategory: dup.bucket,
    });
  }

  // --- Weakness: over-owned categories relative to use ------------------
  const overOwned = usage.categoryUsage.filter(
    (row) => row.itemCount >= 3 && row.wearsPerItem < 1,
  );
  if (overOwned.length > 0) {
    add({
      id: "over-owned",
      type: "weakness",
      priority: "medium",
      title: "Categories over-owned relative to use",
      description: "You own more than you wear in these categories.",
      evidence: overOwned
        .slice(0, 3)
        .map(
          (row) =>
            `${row.category}: ${row.wearsPerItem} wears/item across ${row.itemCount} items.`,
        ),
      suggestedActions: ["Pause buying in these categories and wear what you own."],
    });
  }

  // --- Warning: poor cost-per-wear --------------------------------------
  const worst = usage.costPerWearHighlights?.worstValue ?? [];
  if (worst.length > 0) {
    add({
      id: "poor-cost-per-wear",
      type: "warning",
      priority: worst[0].wearCount <= POOR_VALUE_WEARS ? "high" : "medium",
      title: "Poor cost-per-wear pieces",
      description: "Expensive relative to how often they're worn.",
      evidence: worst
        .slice(0, 3)
        .map((item) => `${item.name}: ${item.costPerWear} per wear (${item.wearCount} wears).`),
      suggestedActions: ["Wear these more often or reconsider keeping them."],
      relatedItemIds: relatedIds(worst),
    });
  }

  // --- Purchase: pricey, barely-worn splurge ----------------------------
  const splurge = ctx.purchaseAnalytics?.mostExpensiveItem;
  if (
    splurge &&
    splurge.costPerWear !== null &&
    splurge.wearCount <= POOR_VALUE_WEARS
  ) {
    add({
      id: "poor-cost-per-wear",
      type: "warning",
      priority: "high",
      title: "Poor cost-per-wear pieces",
      description: "Expensive relative to how often they're worn.",
      evidence: [
        `${splurge.name}: ${splurge.costPerWear} per wear (${splurge.wearCount} wears, most expensive item).`,
      ],
      suggestedActions: ["Wear these more often or reconsider keeping them."],
      relatedItemIds: [splurge.id],
    });
  }

  // --- Outfit quality (optional) ----------------------------------------
  const outfit = ctx.outfitAnalytics;
  if (outfit && outfit.totalOutfits > 0) {
    if (outfit.averageScore >= STRONG_OUTFIT_SCORE) {
      add({
        id: "outfit-quality",
        type: "strength",
        priority: "low",
        title: "Strong outfit compositions",
        description: "Your saved outfits score well on the styling rubric.",
        evidence: [`Average outfit score ${outfit.averageScore.toFixed(1)}/10.`],
        suggestedActions: [],
      });
    } else if (outfit.averageScore < WEAK_OUTFIT_SCORE) {
      add({
        id: "outfit-quality",
        type: "weakness",
        priority: "medium",
        title: "Outfit compositions need work",
        description: "Saved outfits are scoring low on the styling rubric.",
        evidence: [`Average outfit score ${outfit.averageScore.toFixed(1)}/10.`],
        suggestedActions: ["Revisit low-scoring outfits and rebalance them."],
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Text generators — fold the analytics' human-readable strings into the same
// insight ids where possible (so they dedupe), else emit standalone insights.
// ---------------------------------------------------------------------------

type TextMatch = { id: string; type: InsightType; priority: InsightPriority };

/** Maps a health/usage recommendation or weakness string to a canonical id. */
function classify(text: string, fallbackType: InsightType): TextMatch {
  const t = text.toLowerCase();
  if (t.includes("never") && (t.includes("worn") || t.includes("rehome"))) {
    return { id: "never-worn", type: fallbackType, priority: "medium" };
  }
  if (t.includes("stale")) {
    return { id: "stale-items", type: fallbackType, priority: "medium" };
  }
  if (t.includes("rarely worn") || t.includes("rarely-worn")) {
    return { id: "rarely-worn", type: fallbackType, priority: "medium" };
  }
  if (t.includes("over-owned") || t.includes("over-bought")) {
    return { id: "over-owned", type: fallbackType, priority: "medium" };
  }
  if (t.includes("watch list")) {
    return { id: "watch-duplicates", type: fallbackType, priority: "low" };
  }
  if (t.includes("cost") && t.includes("wear")) {
    return { id: "poor-cost-per-wear", type: fallbackType, priority: "medium" };
  }
  if (t.includes("diversify") || t.includes("one brand")) {
    return { id: "brand-diversity", type: fallbackType, priority: "medium" };
  }
  if (t.includes("office")) {
    return { id: "office-coverage-gap", type: fallbackType, priority: "high" };
  }
  const staple = t.match(/add (?:a |an )?(.+?)[.]?$/);
  if (staple) {
    return { id: `gap-${slugify(staple[1])}`, type: fallbackType, priority: "medium" };
  }
  const underrep = t.match(/underrepresented ([a-z]+)/);
  if (underrep) {
    return { id: `gap-${slugify(underrep[1])}`, type: fallbackType, priority: "high" };
  }
  return { id: `${fallbackType}-${slugify(text)}`, type: fallbackType, priority: "medium" };
}

function generateFromText(ctx: InsightContext, add: InsightCollector["add"]): void {
  const feed: { text: string; type: InsightType }[] = [
    ...ctx.wardrobeHealth.weaknesses.map((text) => ({ text, type: "weakness" as const })),
    ...ctx.wardrobeHealth.recommendations.map((text) => ({ text, type: "action" as const })),
    ...ctx.usageAnalytics.recommendations.map((text) => ({ text, type: "action" as const })),
  ];

  for (const { text, type } of feed) {
    const match = classify(text, type);
    add({
      id: match.id,
      type: match.type,
      priority: match.priority,
      title: text,
      description: text,
      evidence: [text],
      suggestedActions: match.type === "action" ? [text] : [],
    });
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

function comparePriority(a: WardrobeInsight, b: WardrobeInsight): number {
  return (
    PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Combines the analytics engines into a deduplicated, priority-ranked
 * {@link InsightReport}. Pure and deterministic.
 */
export function generateInsights(
  context: InsightContext,
  options: InsightOptions = {},
): InsightReport {
  const createdAt = options.generatedAt ?? new Date().toISOString();
  const topActionsLimit = options.topActionsLimit ?? DEFAULT_TOP_ACTIONS;

  const collector = new InsightCollector(createdAt);
  const add = collector.add.bind(collector);

  // Structured generators run first so their typed insights own the id; text
  // strings then merge into them (dedupe) or stand alone.
  generateStructured(context, add);
  generateFromText(context, add);

  const insights = collector.values().sort(comparePriority);

  // RFC-004: never surface a protected item as a removal candidate.
  const protectedSet = new Set(options.protectedItemIds ?? []);
  if (protectedSet.size > 0) {
    for (const insight of insights) {
      if (REMOVAL_FLAVORED_INSIGHT_IDS.has(insight.id) && insight.relatedItemIds) {
        insight.relatedItemIds = insight.relatedItemIds.filter((id) => !protectedSet.has(id));
      }
    }
  }

  const topActions = insights
    .filter((insight) => insight.suggestedActions.length > 0)
    .slice(0, topActionsLimit);
  const warnings = insights.filter((insight) => insight.type === "warning");
  const strengths = insights.filter((insight) => insight.type === "strength");

  const actionCount = insights.filter(
    (insight) => insight.type === "action" || insight.type === "opportunity",
  ).length;
  const overallSummary =
    `Wardrobe health ${context.wardrobeHealth.overallScore}/100 · ` +
    `${insights.length} insights (${actionCount} actions/opportunities, ` +
    `${warnings.length} warnings, ${strengths.length} strengths).`;

  return { overallSummary, insights, topActions, warnings, strengths };
}
