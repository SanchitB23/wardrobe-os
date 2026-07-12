/**
 * Catalog Review domain (RFC-024) — pure wardrobe data-quality classification.
 */

export type {
  CatalogVisualStatus,
  CatalogItemView,
  DuplicateReason,
  SimilarReason,
  CatalogIssueKind,
  IssueSeverity,
  CatalogIssue,
  CatalogDuplicateGroup,
  CatalogSimilarPair,
  CatalogDismissal,
  CatalogReviewModel,
  ClassifyCatalogOptions,
} from "@/domain/catalog-review/types";

export {
  normalizeKey,
  COLOR_NAME_TOKENS,
  COLOR_FAMILY_BY_TOKEN,
  colorFamily,
  colorsInSameFamily,
  tokenizeName,
  garmentTokens,
  garmentSignature,
  parallelSkeletonMatch,
  levenshteinDistance,
  stringSimilarity,
  orderedPairKey,
  isRetiredStatus,
  isValidItemStatus,
  isUnbrandedName,
} from "@/domain/catalog-review/ReviewIssueTypes";

export {
  scoreDuplicatePair,
  findDuplicateGroups,
  areDuplicates,
} from "@/domain/catalog-review/DuplicateDetection";

export {
  namesAreSimilar,
  scoreSimilarPair,
  findSimilarPairs,
} from "@/domain/catalog-review/SimilarItemDetection";

export {
  collectItemIssues,
  collectCatalogIssues,
} from "@/domain/catalog-review/MetadataQuality";

export { catalogQualityScore } from "@/domain/catalog-review/CatalogQualityScore";

export { classifyCatalogIssues } from "@/domain/catalog-review/CatalogReviewEngine";
