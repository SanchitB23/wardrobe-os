/**
 * ROIEvolution (RFC-018B) — pure.
 * ROI Timeline + category cohort summaries from purchases and wears.
 * Reuses utilization / CPW ideas from ROIEngine without replacing it.
 */

import {
  calculateAverageCostPerWear,
  calculateCostPerWear,
} from "@/domain/wardrobe";
import type {
  RoiCategoryCohort,
  RoiTimeline,
  RoiTimelinePoint,
} from "@/domain/shopping/v2/types";

export interface RoiEvolutionPurchase {
  itemId: string;
  name: string;
  category: string | null;
  price: number | null;
  wears: number;
  purchaseDate: string | null;
}

export interface RoiEvolutionInput {
  purchases: RoiEvolutionPurchase[];
  /** Injected clock when purchase dates are missing. */
  generatedAt: string;
}

function utilizationScore(purchases: { wears: number }[]): number {
  if (purchases.length === 0) return 0;
  const worn = purchases.filter((p) => p.wears > 0).length;
  return Math.round((worn / purchases.length) * 100);
}

function categoryScore(purchases: RoiEvolutionPurchase[]): number {
  if (purchases.length === 0) return 0;
  const util = utilizationScore(purchases);
  const withPrice = purchases.filter((p) => p.price != null && p.wears > 0);
  if (withPrice.length === 0) return util;
  const avgCpw =
    withPrice.reduce(
      (sum, p) => sum + (calculateCostPerWear(p.price, p.wears) ?? 0),
      0,
    ) / withPrice.length;
  // Lower CPW → higher cohort score; blend with utilization.
  const cpwScore = Math.max(0, Math.min(100, Math.round(100 - avgCpw)));
  return Math.round(util * 0.6 + cpwScore * 0.4);
}

export function buildRoiTimeline(input: RoiEvolutionInput): RoiTimeline {
  const dated = input.purchases.map((p, index) => ({
    ...p,
    date: p.purchaseDate ?? input.generatedAt,
    order: index,
  }));

  dated.sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    if (c !== 0) return c;
    return a.order - b.order;
  });

  const points: RoiTimelinePoint[] = [];
  const cumulative: RoiEvolutionPurchase[] = [];

  for (const purchase of dated) {
    cumulative.push(purchase);
    const totalSpend = cumulative.reduce((s, p) => s + (p.price ?? 0), 0);
    const totalWears = cumulative.reduce((s, p) => s + p.wears, 0);
    points.push({
      date: purchase.date,
      wardrobeRoiScore: utilizationScore(cumulative),
      averageCostPerWear: calculateAverageCostPerWear(totalSpend, totalWears),
    });
  }

  if (points.length === 0) {
    points.push({
      date: input.generatedAt,
      wardrobeRoiScore: 0,
      averageCostPerWear: null,
    });
  }

  const byCategory = new Map<string, RoiEvolutionPurchase[]>();
  for (const p of input.purchases) {
    const cat = (p.category ?? "uncategorized").trim() || "uncategorized";
    const list = byCategory.get(cat) ?? [];
    list.push(p);
    byCategory.set(cat, list);
  }

  const cohorts: RoiCategoryCohort[] = [...byCategory.entries()]
    .map(([category, list]) => ({
      category,
      score: categoryScore(list),
    }))
    .sort((a, b) => b.score - a.score || a.category.localeCompare(b.category));

  return {
    points,
    bestCategories: cohorts.slice(0, 3),
    worstCategories: [...cohorts].reverse().slice(0, 3),
  };
}
