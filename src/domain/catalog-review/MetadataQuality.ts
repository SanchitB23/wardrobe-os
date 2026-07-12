/**
 * Metadata / image / visual / data-quality issue detection (RFC-024).
 */

import {
  isRetiredStatus,
  isUnbrandedName,
  isValidItemStatus,
  normalizeKey,
} from "@/domain/catalog-review/ReviewIssueTypes";
import type {
  CatalogIssue,
  CatalogItemView,
  CatalogIssueKind,
  IssueSeverity,
} from "@/domain/catalog-review/types";

const SEVERITY: Record<CatalogIssueKind, IssueSeverity> = {
  missing_color: "medium",
  missing_brand: "medium",
  unbranded: "low",
  missing_material: "low",
  missing_category: "high",
  missing_subcategory: "low",
  missing_season: "low",
  missing_occasion: "low",
  missing_image: "high",
  visual_pending: "medium",
  visual_stale: "medium",
  invalid_status: "high",
  bad_code: "high",
};

const LABELS: Record<CatalogIssueKind, string> = {
  missing_color: "Missing color",
  missing_brand: "Missing brand",
  unbranded: "Unbranded",
  missing_material: "Missing material",
  missing_category: "Missing category",
  missing_subcategory: "Missing subcategory",
  missing_season: "Missing season",
  missing_occasion: "Missing occasion",
  missing_image: "Missing image",
  visual_pending: "Visual analysis pending",
  visual_stale: "Stale visual attributes",
  invalid_status: "Invalid status",
  bad_code: "Bad or empty code",
};

function issue(kind: CatalogIssueKind, itemId: string): CatalogIssue {
  return {
    kind,
    itemId,
    severity: SEVERITY[kind],
    label: LABELS[kind],
  };
}

export function collectItemIssues(item: CatalogItemView): CatalogIssue[] {
  const out: CatalogIssue[] = [];

  if (!normalizeKey(item.code)) {
    out.push(issue("bad_code", item.id));
  }
  if (!isValidItemStatus(item.status)) {
    out.push(issue("invalid_status", item.id));
  }
  if (!item.colorId) {
    out.push(issue("missing_color", item.id));
  }
  if (!item.brandId) {
    out.push(issue("missing_brand", item.id));
  } else if (isUnbrandedName(item.brandName)) {
    out.push(issue("unbranded", item.id));
  }
  if (!item.hasMaterial) {
    out.push(issue("missing_material", item.id));
  }
  if (!item.categoryId) {
    out.push(issue("missing_category", item.id));
  }
  if (item.categoryId && !item.subcategoryId) {
    out.push(issue("missing_subcategory", item.id));
  }
  if (!item.hasSeason) {
    out.push(issue("missing_season", item.id));
  }
  if (!item.hasOccasion) {
    out.push(issue("missing_occasion", item.id));
  }
  if (!item.hasPrimaryImage) {
    out.push(issue("missing_image", item.id));
  }
  if (item.visualStatus === "none" || item.visualStatus === "pending") {
    out.push(issue("visual_pending", item.id));
  }
  if (item.visualStatus === "stale") {
    out.push(issue("visual_stale", item.id));
  }

  return out;
}

export type IssueBuckets = {
  missingMetadata: CatalogIssue[];
  unbranded: CatalogIssue[];
  missingImages: CatalogIssue[];
  visualPending: CatalogIssue[];
  dataQuality: CatalogIssue[];
};

const METADATA_KINDS = new Set<CatalogIssueKind>([
  "missing_color",
  "missing_material",
  "missing_category",
  "missing_subcategory",
  "missing_season",
  "missing_occasion",
]);

export function collectCatalogIssues(
  items: CatalogItemView[],
  options: {
    includeRetired?: boolean;
    reviewedItemIds?: ReadonlySet<string>;
    hideReviewedIssues?: boolean;
  } = {},
): IssueBuckets {
  const includeRetired = options.includeRetired ?? false;
  const hideReviewed = options.hideReviewedIssues ?? false;
  const reviewed = options.reviewedItemIds ?? new Set<string>();

  const buckets: IssueBuckets = {
    missingMetadata: [],
    unbranded: [],
    missingImages: [],
    visualPending: [],
    dataQuality: [],
  };

  for (const item of items) {
    if (!includeRetired && isRetiredStatus(item.status)) continue;
    if (hideReviewed && reviewed.has(item.id)) continue;

    for (const iss of collectItemIssues(item)) {
      if (METADATA_KINDS.has(iss.kind)) {
        buckets.missingMetadata.push(iss);
      } else if (iss.kind === "missing_brand" || iss.kind === "unbranded") {
        buckets.unbranded.push(iss);
      } else if (iss.kind === "missing_image") {
        buckets.missingImages.push(iss);
      } else if (
        iss.kind === "visual_pending" ||
        iss.kind === "visual_stale"
      ) {
        buckets.visualPending.push(iss);
      } else {
        buckets.dataQuality.push(iss);
      }
    }
  }

  return buckets;
}
