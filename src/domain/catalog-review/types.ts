/**
 * Catalog Review domain types (RFC-024) — pure, no I/O.
 */

export type CatalogVisualStatus =
  | "none"
  | "pending"
  | "accepted"
  | "rejected"
  | "stale";

/** Normalized inventory row for classification. */
export type CatalogItemView = {
  id: string;
  code: string;
  name: string;
  status: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  brandId: string | null;
  brandName: string | null;
  colorId: string | null;
  colorName: string | null;
  hasMaterial: boolean;
  hasSeason: boolean;
  hasOccasion: boolean;
  hasPrimaryImage: boolean;
  visualStatus: CatalogVisualStatus;
};

export type DuplicateReason = "same_code" | "same_identity";

export type SimilarReason =
  | "similar_name_diff_color"
  | "similar_name_diff_meta";

export type CatalogIssueKind =
  | "missing_color"
  | "missing_brand"
  | "unbranded"
  | "missing_material"
  | "missing_category"
  | "missing_subcategory"
  | "missing_season"
  | "missing_occasion"
  | "missing_image"
  | "visual_pending"
  | "visual_stale"
  | "invalid_status"
  | "bad_code";

export type IssueSeverity = "high" | "medium" | "low";

export type CatalogIssue = {
  kind: CatalogIssueKind;
  itemId: string;
  severity: IssueSeverity;
  label: string;
};

export type CatalogDuplicateGroup = {
  id: string;
  reason: DuplicateReason;
  label: string;
  itemIds: string[];
};

export type CatalogSimilarPair = {
  id: string;
  reason: SimilarReason;
  label: string;
  itemIdA: string;
  itemIdB: string;
};

export type CatalogDismissal = {
  itemIdA: string;
  itemIdB: string;
  kind: "duplicate" | "similar";
};

export type CatalogReviewModel = {
  items: CatalogItemView[];
  totalActive: number;
  totalIncluded: number;
  duplicates: CatalogDuplicateGroup[];
  similar: CatalogSimilarPair[];
  missingMetadata: CatalogIssue[];
  unbranded: CatalogIssue[];
  missingImages: CatalogIssue[];
  visualPending: CatalogIssue[];
  dataQuality: CatalogIssue[];
  qualityScore: number;
};

export type ClassifyCatalogOptions = {
  includeRetired?: boolean;
  dismissals?: CatalogDismissal[];
  reviewedItemIds?: ReadonlySet<string>;
  /** When true, hide issues for reviewed items (default false — still show). */
  hideReviewedIssues?: boolean;
};
