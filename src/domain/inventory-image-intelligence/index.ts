/**
 * Inventory Image Intelligence (RFC-020) — public domain surface.
 */

export type {
  VisualAttributeStatus,
  VisualStyleAttributes,
} from "@/domain/inventory-image-intelligence/types";
export {
  VISUAL_CONFIDENCE_THRESHOLD,
  VISUAL_ATTRIBUTE_STATUSES,
} from "@/domain/inventory-image-intelligence/types";
export {
  analyzeInventoryImage,
  type AnalyzeInventoryImageOptions,
} from "@/domain/inventory-image-intelligence/InventoryImageAnalyzer";
export {
  mergeVisualIntoStyleDNAItem,
  visualManualDiff,
  type StyleDNAMergeInput,
} from "@/domain/inventory-image-intelligence/StyleDNAVisualMerge";
