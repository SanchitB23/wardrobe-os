/**
 * Catalog Review engine — compose duplicate, similar, metadata, score (RFC-024).
 */

import { catalogQualityScore } from "@/domain/catalog-review/CatalogQualityScore";
import { findDuplicateGroups } from "@/domain/catalog-review/DuplicateDetection";
import { collectCatalogIssues } from "@/domain/catalog-review/MetadataQuality";
import { isRetiredStatus } from "@/domain/catalog-review/ReviewIssueTypes";
import { findSimilarPairs } from "@/domain/catalog-review/SimilarItemDetection";
import type {
  CatalogItemView,
  CatalogReviewModel,
  ClassifyCatalogOptions,
} from "@/domain/catalog-review/types";

export function classifyCatalogIssues(
  items: CatalogItemView[],
  options: ClassifyCatalogOptions = {},
): CatalogReviewModel {
  const includeRetired = options.includeRetired ?? false;
  const dismissals = options.dismissals ?? [];

  const included = includeRetired
    ? items
    : items.filter((item) => !isRetiredStatus(item.status));

  const duplicates = findDuplicateGroups(items, {
    includeRetired,
    dismissals,
  });
  const similar = findSimilarPairs(items, { includeRetired, dismissals });
  const buckets = collectCatalogIssues(items, {
    includeRetired,
    reviewedItemIds: options.reviewedItemIds,
    hideReviewedIssues: options.hideReviewedIssues,
  });

  const draft: CatalogReviewModel = {
    items: included,
    totalActive: items.filter((i) => !isRetiredStatus(i.status)).length,
    totalIncluded: included.length,
    duplicates,
    similar,
    missingMetadata: buckets.missingMetadata,
    unbranded: buckets.unbranded,
    missingImages: buckets.missingImages,
    visualPending: buckets.visualPending,
    dataQuality: buckets.dataQuality,
    qualityScore: 0,
  };

  draft.qualityScore = catalogQualityScore(draft);
  return draft;
}
