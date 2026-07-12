import type { SimilarReason } from "@/domain/catalog-review/types";

const SIMILAR_REASON_LABELS: Record<SimilarReason, string> = {
  similar_name_diff_color: "Same name pattern, different color",
  similar_name_diff_meta: "Same name pattern, different brand",
};

export function formatSimilarReason(reason: SimilarReason): string {
  return SIMILAR_REASON_LABELS[reason];
}
