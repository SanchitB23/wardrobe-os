/**
 * Category Optimization (RFC-015A) — Replacement opportunities (pure).
 * Prospective stubs only — Buy vs Skip still decides (RFC-001).
 */

import {
  DEFAULT_REPLACEMENT_TEMPLATES,
  MAX_REPLACEMENT_OPPORTUNITIES,
} from "@/domain/category-optimization/CategoryOptimizationConstants";
import { toCategoryKey } from "@/domain/category-optimization/CategoryOptimizationScoring";
import type {
  CategoryAnalysis,
  CategoryOptimizationContext,
  OptimizationPlanSummary,
  ReplacementOpportunity,
} from "@/domain/category-optimization/types";

function categoryNoun(label: string, categoryKey: string): string {
  const fromLabel = label.replace(/^\d+\s+/, "").trim();
  if (fromLabel) return fromLabel;
  return categoryKey.replace(/-/g, " ");
}

/**
 * Derive replacement stubs from gaps / missing diversity / retire pressure.
 * Empty when the category is already balanced with no gaps.
 */
export function deriveReplacementOpportunities(input: {
  context: CategoryOptimizationContext;
  analysis: CategoryAnalysis;
  summary: Pick<OptimizationPlanSummary, "retire" | "rotate" | "keep">;
}): ReplacementOpportunity[] {
  const { context, analysis, summary } = input;
  const needsReplacement =
    summary.retire > 0 ||
    analysis.reasonCodes.includes("over_dense") ||
    analysis.reasonCodes.includes("under_dense") ||
    (context.gapLabels?.length ?? 0) > 0 ||
    (context.missingStyleHints?.length ?? 0) > 0;

  if (!needsReplacement && analysis.reasonCodes.includes("balanced")) {
    return [];
  }

  const opportunities: ReplacementOpportunity[] = [];
  const baseCategory =
    context.items[0]?.category ??
    categoryNoun(analysis.label, analysis.categoryKey).split(" ")[0] ??
    "tops";

  // Prefer explicit gap labels from health.
  for (const gap of context.gapLabels ?? []) {
    if (opportunities.length >= MAX_REPLACEMENT_OPPORTUNITIES) break;
    const id = `gap-${toCategoryKey(gap)}`;
    opportunities.push({
      id,
      name: gap,
      category: baseCategory,
      styleHints: [gap],
      rationale: `Wardrobe gap: ${gap} — evaluate before buying.`,
      reasonCodes: ["diversity_gap"],
      prospective: {
        name: gap,
        category: baseCategory,
        styleTags: [gap],
        notes: `Suggested from Category Optimization (${analysis.categoryKey}).`,
      },
    });
  }

  // Diversity hints (colors / styles missing from the cluster).
  for (const hint of context.missingStyleHints ?? []) {
    if (opportunities.length >= MAX_REPLACEMENT_OPPORTUNITIES) break;
    const name = `${hint} alternative`;
    const id = `hint-${toCategoryKey(hint)}`;
    if (opportunities.some((o) => o.id === id)) continue;
    opportunities.push({
      id,
      name,
      category: baseCategory,
      styleHints: [hint],
      rationale: `Adds ${hint} diversity versus the current cluster.`,
      reasonCodes: ["diversity_gap"],
      prospective: {
        name,
        category: baseCategory,
        color: hint,
        styleTags: [hint],
        notes: `Suggested from Category Optimization (${analysis.categoryKey}).`,
      },
    });
  }

  // Fallback templates when retiring duplicates without specific gaps.
  if (
    opportunities.length === 0 &&
    (summary.retire > 0 || analysis.reasonCodes.includes("over_dense"))
  ) {
    for (const template of DEFAULT_REPLACEMENT_TEMPLATES) {
      if (opportunities.length >= MAX_REPLACEMENT_OPPORTUNITIES) break;
      const id = `tpl-${toCategoryKey(template.name)}`;
      opportunities.push({
        id,
        name: template.name,
        category: baseCategory,
        styleHints: [...template.styleHints],
        rationale:
          "Diversify after consolidating near-duplicates — run Buy vs Skip before purchasing.",
        reasonCodes: ["duplicate_cluster", "diversity_gap"],
        prospective: {
          name: template.name,
          category: baseCategory,
          color: template.color,
          styleTags: [...template.styleHints],
          notes: `Suggested from Category Optimization (${analysis.categoryKey}).`,
        },
      });
    }
  }

  return opportunities.slice(0, MAX_REPLACEMENT_OPPORTUNITIES);
}
