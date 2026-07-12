"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  applyBulkEdit,
  fetchBulkEditLookups,
} from "@/features/inventory/services/bulk-actions.service";
import {
  deleteItemImage,
  fetchItemImagesForItem,
  fetchPrimaryImageUrl,
  fetchPrimaryImageUrlsForItems,
  setPrimaryItemImage,
  uploadItemImage,
  uploadPrimaryItemImage,
} from "@/features/inventory/services/images.service";
import type { ImageType } from "@/types/wardrobe";
import { fetchImportLookups } from "@/features/inventory/services/import.service";
import { fetchWardrobeItemDetail } from "@/features/inventory/services/item-detail.service";
import {
  bulkSyncJsonWardrobeItems,
  type JsonSyncInput,
} from "@/features/inventory/services/json-sync.service";
import {
  bulkCreateWardrobeItems,
  createBrand,
  createWardrobeItem,
  fetchCategoryCounts,
  fetchInventorySummary,
  fetchLookups,
  fetchWardrobeItemById,
  fetchWardrobeItems,
  retireWardrobeItem,
  setWardrobeItemFavorite,
  updateWardrobeItem,
} from "@/features/inventory/services/inventory.service";
import {
  bulkCleanupWardrobeItems,
  dismissCatalogPair,
  getCatalogReview,
  markCatalogItemReviewed,
} from "@/features/inventory/services/review.service";
import {
  fetchWardrobeItemRelations,
  saveItemRelations,
} from "@/features/inventory/services/relations.service";
import type { RelationSelections } from "@/domain/inventory-relations";
import {
  acceptItemVisualAttributes,
  analyzeItemPrimaryImage,
  backfillVisualAnalysis,
  getItemVisualAttributes,
  listVisualBackfillCandidates,
  rejectItemVisualAttributes,
} from "@/features/inventory/services/visual-attributes.service";
import type {
  BulkCleanupMode,
  BulkEditInput,
  CreateWardrobeItemInput,
  InventoryFilters,
  LookupOption,
  UpdateWardrobeItemInput,
  WardrobeItemRow,
} from "@/features/inventory/types";
import { invalidateWardrobeQueries } from "@/shared/hooks/invalidate-wardrobe-queries";
import { wardrobeKeys, type CategoryCountFilters } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

export function useInventorySummary() {
  return useQuery({
    queryKey: wardrobeKeys.summary(),
    queryFn: async () => unwrapData(await fetchInventorySummary()),
  });
}

export function useWardrobeItems(
  filters: InventoryFilters,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: wardrobeKeys.items(filters),
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const items = unwrapData(await fetchWardrobeItems(filters));
      const imageMap = unwrapData(
        await fetchPrimaryImageUrlsForItems(items.map((item) => item.id)),
      );

      return items.map((item) => ({
        ...item,
        primary_image_url: imageMap[item.id] ?? null,
      }));
    },
  });
}

export function useWardrobeItem(id: string) {
  return useQuery({
    queryKey: wardrobeKeys.item(id),
    queryFn: async () => {
      const result = await fetchWardrobeItemById(id);
      if (result.error) {
        throw result.error;
      }
      if (!result.data) {
        return null;
      }

      const primaryResult = await fetchPrimaryImageUrl(id);
      if (primaryResult.error) {
        throw primaryResult.error;
      }

      return {
        ...result.data,
        primary_image_url: primaryResult.data,
      };
    },
    enabled: Boolean(id),
  });
}

export function useItemImages(itemId: string) {
  return useQuery({
    queryKey: wardrobeKeys.itemImages(itemId),
    queryFn: async () => unwrapData(await fetchItemImagesForItem(itemId)),
    enabled: Boolean(itemId),
  });
}

export function useItemVisualAttributes(itemId: string) {
  return useQuery({
    queryKey: wardrobeKeys.itemVisualAttributes(itemId),
    queryFn: async () => {
      const result = await getItemVisualAttributes(itemId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: Boolean(itemId),
  });
}

export function useAnalyzeItemPrimaryImageMutation(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => unwrapData(await analyzeItemPrimaryImage(itemId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.itemVisualAttributes(itemId),
      });
      toast.success("Visual analysis ready for review");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to analyze primary image");
    },
  });
}

export function useAcceptItemVisualAttributesMutation(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      unwrapData(await acceptItemVisualAttributes(itemId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.itemVisualAttributes(itemId),
      });
      await invalidateWardrobeQueries(queryClient);
      toast.success("Visual attributes accepted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to accept visual attributes");
    },
  });
}

export function useRejectItemVisualAttributesMutation(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      unwrapData(await rejectItemVisualAttributes(itemId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.itemVisualAttributes(itemId),
      });
      toast.success("Visual attributes rejected");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject visual attributes");
    },
  });
}

export function useVisualBackfillCandidates() {
  return useQuery({
    queryKey: wardrobeKeys.visualBackfillCandidates(),
    queryFn: async () => unwrapData(await listVisualBackfillCandidates()),
  });
}

export function useBackfillVisualAnalysisMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemIds: string[]) =>
      unwrapData(await backfillVisualAnalysis(itemIds)),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.visualBackfillCandidates(),
      });
      await queryClient.invalidateQueries({
        queryKey: [...wardrobeKeys.all, "item-visual-attributes"],
      });
      toast.success(
        `Analyzed ${result.ok.length} item${result.ok.length === 1 ? "" : "s"}` +
          (result.failed.length
            ? ` (${result.failed.length} failed)`
            : ""),
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Backfill analysis failed");
    },
  });
}

export function useUploadItemImageMutation(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      file: File;
      imageType: ImageType;
      makePrimary?: boolean;
    }) =>
      unwrapData(
        await uploadItemImage({
          itemId,
          file: input.file,
          imageType: input.imageType,
          makePrimary: input.makePrimary,
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.itemImages(itemId),
      });
      await invalidateWardrobeQueries(queryClient);
      toast.success("Image uploaded");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload image");
    },
  });
}

export function useSetPrimaryImageMutation(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageId: string) => {
      const { error } = await setPrimaryItemImage(itemId, imageId);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.itemImages(itemId),
      });
      await invalidateWardrobeQueries(queryClient);
      toast.success("Primary image updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to set primary image");
    },
  });
}

export function useDeleteItemImageMutation(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageId: string) => {
      const { error } = await deleteItemImage(imageId);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.itemImages(itemId),
      });
      await invalidateWardrobeQueries(queryClient);
      toast.success("Image deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete image");
    },
  });
}

export function useWardrobeItemRelations(itemId: string) {
  return useQuery({
    queryKey: wardrobeKeys.itemRelations(itemId),
    queryFn: async () => unwrapData(await fetchWardrobeItemRelations(itemId)),
    enabled: Boolean(itemId),
  });
}

export function useSaveItemRelationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      itemId: string;
      selections: RelationSelections;
    }) => unwrapData(await saveItemRelations(input.itemId, input.selections)),
    onSuccess: async (_result, input) => {
      await invalidateWardrobeQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.itemRelations(input.itemId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save item relations.");
    },
  });
}

export function useWardrobeItemDetail(itemId: string) {
  return useQuery({
    queryKey: wardrobeKeys.itemDetail(itemId),
    queryFn: async () => {
      const result = await fetchWardrobeItemDetail(itemId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: Boolean(itemId),
  });
}

export function useCategoryCounts(filters: CategoryCountFilters) {
  return useQuery({
    queryKey: wardrobeKeys.categoryCounts(filters),
    queryFn: async () => unwrapData(await fetchCategoryCounts(filters)),
  });
}

export function useWardrobeLookups() {
  return useQuery({
    queryKey: wardrobeKeys.lookups(),
    queryFn: async () => unwrapData(await fetchLookups()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBulkEditLookups() {
  return useQuery({
    queryKey: wardrobeKeys.bulkEditLookups(),
    queryFn: async () => unwrapData(await fetchBulkEditLookups()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBulkEditMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BulkEditInput) =>
      unwrapData(await applyBulkEdit(input)),
    onSuccess: async (result) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(
        `Bulk edit applied to ${result.itemCount} item${result.itemCount === 1 ? "" : "s"} (${result.affected} change${result.affected === 1 ? "" : "s"})`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Bulk edit failed. Please try again.");
    },
  });
}

export function useImportLookups() {
  return useQuery({
    queryKey: [...wardrobeKeys.all, "import-lookups"] as const,
    queryFn: async () => unwrapData(await fetchImportLookups()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBrandMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => unwrapData(await createBrand(name)),
    onSuccess: async (brand: LookupOption) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(`Added brand ${brand.name}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add brand.");
    },
  });
}

export function useCreateWardrobeItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWardrobeItemInput) =>
      unwrapData(await createWardrobeItem(input)),
    onSuccess: async (item: WardrobeItemRow) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(`Added ${item.name}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add item");
    },
  });
}

export function useUpdateWardrobeItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateWardrobeItemInput) =>
      unwrapData(await updateWardrobeItem(input)),
    onSuccess: async (item: WardrobeItemRow) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(`Updated ${item.name}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update item");
    },
  });
}

export function useToggleWardrobeItemFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; favorite: boolean }) =>
      unwrapData(await setWardrobeItemFavorite(input.id, input.favorite)),
    onSuccess: async (item: WardrobeItemRow) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(
        item.favorite ? "Added to favorites" : "Removed from favorites",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update favorite");
    },
  });
}

type RetireWardrobeItemInput = {
  id: string;
  name: string;
};

export function useRetireWardrobeItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: RetireWardrobeItemInput) =>
      unwrapData(await retireWardrobeItem(id)),
    onSuccess: async (item) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(`Retired ${item.name}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to retire item");
    },
  });
}

type UploadPrimaryImageInput = {
  itemId: string;
  file: File;
};

export function useUploadPrimaryItemImageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, file }: UploadPrimaryImageInput) =>
      unwrapData(await uploadPrimaryItemImage(itemId, file)),
    onSuccess: async () => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Primary image uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload image. Please try again.");
    },
  });
}

export function useBulkImportWardrobeItemsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inputs: CreateWardrobeItemInput[]) =>
      unwrapData(await bulkCreateWardrobeItems(inputs)),
    onSuccess: async (items) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(`Imported ${items.length} item${items.length === 1 ? "" : "s"}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to import items. Please try again.");
    },
  });
}

export function useBulkImportJsonWardrobeItemsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: JsonSyncInput) =>
      unwrapData(await bulkSyncJsonWardrobeItems(input)),
    onSuccess: async (result) => {
      await invalidateWardrobeQueries(queryClient);

      const parts: string[] = [];
      if (result.inserted > 0) {
        parts.push(`${result.inserted} inserted`);
      }
      if (result.updated > 0) {
        parts.push(`${result.updated} updated`);
      }
      if (result.skipped > 0) {
        parts.push(`${result.skipped} skipped`);
      }

      if (parts.length > 0) {
        toast.success(`Sync complete: ${parts.join(", ")}`);
      }

      if (result.failed.length > 0) {
        toast.error(
          `${result.failed.length} item${result.failed.length === 1 ? "" : "s"} failed during sync`,
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sync JSON items. Please try again.");
    },
  });
}

export function useCatalogReviewData(filters: {
  includeRetired?: boolean;
  hideReviewedIssues?: boolean;
} = {}) {
  return useQuery({
    queryKey: [...wardrobeKeys.review(), filters] as const,
    queryFn: async () => unwrapData(await getCatalogReview(filters)),
  });
}

/** @deprecated Prefer useCatalogReviewData */
export function useReviewCleanupData() {
  return useCatalogReviewData({ includeRetired: true });
}

type BulkCleanupInput = {
  ids: string[];
  mode: BulkCleanupMode;
};

export function useBulkCleanupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, mode }: BulkCleanupInput) =>
      unwrapData(await bulkCleanupWardrobeItems(ids, mode)),
    onSuccess: async (result) => {
      await invalidateWardrobeQueries(queryClient);
      if (result.mode === "hard_delete") {
        toast.success(
          `Permanently deleted ${result.processed} item${result.processed === 1 ? "" : "s"}`,
        );
      } else {
        toast.success(
          `Retired ${result.processed} item${result.processed === 1 ? "" : "s"}`,
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Cleanup failed. Please try again.");
    },
  });
}

export function useDismissCatalogPairMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      itemIdA: string;
      itemIdB: string;
      kind: "duplicate" | "similar";
    }) => unwrapData(await dismissCatalogPair(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wardrobeKeys.review() });
      toast.success("Dismissed from Catalog Review");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not dismiss.");
    },
  });
}

export function useMarkCatalogReviewedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) =>
      unwrapData(await markCatalogItemReviewed(itemId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wardrobeKeys.review() });
      toast.success("Marked reviewed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not mark reviewed.");
    },
  });
}

export type { JsonSyncInput };
