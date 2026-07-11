/**
 * Visual similarity (RFC-019) — pure attribute overlap between a Vision
 * detection and an inventory item. Not image embeddings (reserved on
 * VisionAnalysis.metadata.embeddings). Deterministic.
 */

import type { DetectedItem } from "@/domain/vision";
import type { VisionInventoryItem } from "@/domain/vision-intelligence/types";

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function tokens(s: string): string[] {
  return s
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 1);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const as = new Set(a);
  const bs = new Set(b);
  let inter = 0;
  for (const t of as) if (bs.has(t)) inter += 1;
  const union = as.size + bs.size - inter;
  return union === 0 ? 0 : inter / union;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * 0–1 similarity. Weights: category 0.35, color 0.25, material 0.15,
 * name/label tokens 0.25.
 */
export function scoreVisualSimilarity(
  detection: DetectedItem,
  item: VisionInventoryItem,
): number {
  const cand = detection.styleDNACandidate;
  const detCategory = norm(cand.category ?? detection.category);
  const itemCategory = norm(item.category);
  const detColor = norm(cand.color ?? detection.colors[0]?.name ?? null);
  const itemColor = norm(item.color);
  const detMaterial = norm(cand.material ?? detection.material);
  const itemMaterial = norm(item.material ?? null);

  let score = 0;

  if (detCategory && itemCategory) {
    if (detCategory === itemCategory) score += 0.35;
    else if (detCategory.includes(itemCategory) || itemCategory.includes(detCategory)) {
      score += 0.2;
    }
  }

  if (detColor && itemColor) {
    if (detColor === itemColor) score += 0.25;
    else if (detColor.includes(itemColor) || itemColor.includes(detColor)) score += 0.12;
  }

  if (detMaterial && itemMaterial && detMaterial === itemMaterial) {
    score += 0.15;
  }

  const labelTokens = tokens(
    [detection.label, cand.name, cand.brandGuess].filter(Boolean).join(" "),
  );
  const itemTokens = tokens(item.name);
  score += 0.25 * jaccard(labelTokens, itemTokens);

  return clamp01(Math.round(score * 1000) / 1000);
}

/** Rank inventory by similarity to a detection (desc). */
export function rankInventoryMatches(
  detection: DetectedItem,
  inventory: VisionInventoryItem[],
): { item: VisionInventoryItem; similarity: number }[] {
  return inventory
    .map((item) => ({ item, similarity: scoreVisualSimilarity(detection, item) }))
    .filter((m) => m.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity);
}
