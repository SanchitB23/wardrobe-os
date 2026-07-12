/**
 * Deterministic catalog quality score 0–100 (RFC-024).
 */

import type { CatalogReviewModel } from "@/domain/catalog-review/types";

const WEIGHTS = {
  duplicateGroup: 8,
  similarPair: 2,
  missingMetadata: 3,
  unbranded: 2,
  missingImage: 6,
  visualPending: 3,
  dataQuality: 5,
} as const;

/**
 * Start at 100; subtract weighted issue counts (capped at 0).
 * Score is relative to catalog size so large wardrobes aren't unfairly punished
 * beyond a soft density factor.
 */
export function catalogQualityScore(
  model: Pick<
    CatalogReviewModel,
    | "totalIncluded"
    | "duplicates"
    | "similar"
    | "missingMetadata"
    | "unbranded"
    | "missingImages"
    | "visualPending"
    | "dataQuality"
  >,
): number {
  const n = Math.max(model.totalIncluded, 1);
  const density = Math.min(1, 40 / n); // soften for large catalogs

  let penalty =
    model.duplicates.length * WEIGHTS.duplicateGroup +
    model.similar.length * WEIGHTS.similarPair +
    model.missingMetadata.length * WEIGHTS.missingMetadata +
    model.unbranded.length * WEIGHTS.unbranded +
    model.missingImages.length * WEIGHTS.missingImage +
    model.visualPending.length * WEIGHTS.visualPending +
    model.dataQuality.length * WEIGHTS.dataQuality;

  penalty = Math.round(penalty * (0.55 + 0.45 * density));
  return Math.max(0, Math.min(100, 100 - penalty));
}
