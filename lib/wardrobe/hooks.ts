"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  bulkCreateWardrobeItems,
  createWardrobeItem,
  fetchCategoryCounts,
  fetchInventorySummary,
  fetchLookups,
  fetchWardrobeItemById,
  fetchWardrobeItems,
  retireWardrobeItem,
  updateWardrobeItem,
} from "@/lib/wardrobe/queries";
import {
  fetchImportLookups,
} from "@/lib/wardrobe/import";
import {
  applyBulkEdit,
  fetchBulkEditLookups,
} from "@/lib/wardrobe/bulk-actions";
import { fetchWardrobeDashboardAnalytics } from "@/lib/wardrobe/analytics";
import {
  createPurchase,
  fetchItemPurchaseDetail,
  fetchPurchaseChartData,
  fetchPurchases,
  updatePurchase,
} from "@/lib/wardrobe/purchases";
import {
  createOutfit,
  deleteOutfit,
  duplicateOutfit,
  fetchOutfitById,
  fetchOutfitLookups,
  fetchOutfitPickerItems,
  fetchOutfits,
  updateOutfit,
} from "@/lib/wardrobe/outfits";
import {
  createWearLog,
  deleteWearLog,
  fetchItemWearSummary,
  fetchOccasions,
  fetchWearLogs,
} from "@/lib/wardrobe/wear-logs";
import { bulkSyncJsonWardrobeItems, type JsonSyncInput } from "@/lib/wardrobe/json-sync";
import {
  buildDuplicateReview,
  bulkCleanupWardrobeItems,
  fetchAllItemsForReview,
} from "@/lib/wardrobe/review";
import {
  fetchItemImagesForItem,
  fetchPrimaryImageUrl,
  fetchPrimaryImageUrlsForItems,
  uploadPrimaryItemImage,
} from "@/lib/wardrobe/images";
import { fetchWardrobeItemDetail } from "@/lib/wardrobe/item-detail";
import { fetchWardrobeItemRelations } from "@/lib/wardrobe/relations";
import { wardrobeKeys, type CategoryCountFilters } from "@/lib/wardrobe/query-keys";
import type {
  BulkCleanupMode,
  BulkEditInput,
  CreateWardrobeItemInput,
  InventoryFilters,
  UpdateWardrobeItemInput,
  WardrobeItemRow,
  WearLogFilters,
  CreateWearLogInput,
  PurchaseFilters,
  CreatePurchaseInput,
  UpdatePurchaseInput,
  SaveOutfitInput,
  UpdateOutfitInput,
  OutfitSlot,
} from "@/types/wardrobe";

function unwrapData<T>(result: { data: T | null; error: Error | null }): T {
  if (result.error) {
    throw result.error;
  }
  if (result.data === null) {
    throw new Error("No data returned");
  }
  return result.data;
}

async function invalidateInventoryQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: wardrobeKeys.all });
}

export function useInventorySummary() {
  return useQuery({
    queryKey: wardrobeKeys.summary(),
    queryFn: async () => unwrapData(await fetchInventorySummary()),
  });
}

export function useWardrobeDashboard() {
  return useQuery({
    queryKey: wardrobeKeys.dashboard(),
    queryFn: async () => unwrapData(await fetchWardrobeDashboardAnalytics()),
  });
}

export function useWardrobeItems(filters: InventoryFilters) {
  return useQuery({
    queryKey: wardrobeKeys.items(filters),
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

export function useWardrobeItemRelations(itemId: string) {
  return useQuery({
    queryKey: wardrobeKeys.itemRelations(itemId),
    queryFn: async () => unwrapData(await fetchWardrobeItemRelations(itemId)),
    enabled: Boolean(itemId),
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
      await invalidateInventoryQueries(queryClient);
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

export function useCreateWardrobeItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWardrobeItemInput) =>
      unwrapData(await createWardrobeItem(input)),
    onSuccess: async (item: WardrobeItemRow) => {
      await invalidateInventoryQueries(queryClient);
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
      await invalidateInventoryQueries(queryClient);
      toast.success(`Updated ${item.name}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update item");
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
      await invalidateInventoryQueries(queryClient);
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
      await invalidateInventoryQueries(queryClient);
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
      await invalidateInventoryQueries(queryClient);
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
      await invalidateInventoryQueries(queryClient);

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

export function useReviewCleanupData() {
  return useQuery({
    queryKey: wardrobeKeys.review(),
    queryFn: async () => {
      const items = unwrapData(await fetchAllItemsForReview());
      return buildDuplicateReview(items);
    },
  });
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
      await invalidateInventoryQueries(queryClient);
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

export function useOccasions() {
  return useQuery({
    queryKey: wardrobeKeys.occasions(),
    queryFn: async () => unwrapData(await fetchOccasions()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWearLogs(filters: WearLogFilters) {
  return useQuery({
    queryKey: wardrobeKeys.wearLogs(filters),
    queryFn: async () => unwrapData(await fetchWearLogs(filters)),
  });
}

export function useItemWearSummary(itemId: string) {
  return useQuery({
    queryKey: wardrobeKeys.itemWearSummary(itemId),
    queryFn: async () => unwrapData(await fetchItemWearSummary(itemId)),
    enabled: Boolean(itemId),
  });
}

export function useCreateWearLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWearLogInput) =>
      unwrapData(await createWearLog(input)),
    onSuccess: async () => {
      await invalidateInventoryQueries(queryClient);
      toast.success("Wear logged");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log wear");
    },
  });
}

export function useDeleteWearLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteWearLog(id);
      if (result.error) {
        throw result.error;
      }
    },
    onSuccess: async () => {
      await invalidateInventoryQueries(queryClient);
      toast.success("Wear log deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete wear log");
    },
  });
}

export function usePurchases(filters: PurchaseFilters) {
  return useQuery({
    queryKey: wardrobeKeys.purchases(filters),
    queryFn: async () => unwrapData(await fetchPurchases(filters)),
  });
}

export function usePurchaseCharts(filters: PurchaseFilters) {
  return useQuery({
    queryKey: wardrobeKeys.purchaseCharts(filters),
    queryFn: async () => unwrapData(await fetchPurchaseChartData(filters)),
  });
}

export function useItemPurchaseDetail(itemId: string) {
  return useQuery({
    queryKey: wardrobeKeys.itemPurchase(itemId),
    queryFn: async () => unwrapData(await fetchItemPurchaseDetail(itemId)),
    enabled: Boolean(itemId),
  });
}

export function useCreatePurchaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePurchaseInput) =>
      unwrapData(await createPurchase(input)),
    onSuccess: async () => {
      await invalidateInventoryQueries(queryClient);
      toast.success("Purchase saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save purchase");
    },
  });
}

export function useUpdatePurchaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePurchaseInput) =>
      unwrapData(await updatePurchase(input)),
    onSuccess: async () => {
      await invalidateInventoryQueries(queryClient);
      toast.success("Purchase updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update purchase");
    },
  });
}

export function useOutfits() {
  return useQuery({
    queryKey: wardrobeKeys.outfits(),
    queryFn: async () => unwrapData(await fetchOutfits()),
  });
}

export function useOutfit(id: string) {
  return useQuery({
    queryKey: wardrobeKeys.outfit(id),
    queryFn: async () => unwrapData(await fetchOutfitById(id)),
    enabled: Boolean(id),
  });
}

export function useOutfitLookups() {
  return useQuery({
    queryKey: wardrobeKeys.outfitLookups(),
    queryFn: async () => unwrapData(await fetchOutfitLookups()),
  });
}

export function useOutfitPickerItems(slot: OutfitSlot, search: string) {
  return useQuery({
    queryKey: wardrobeKeys.outfitPickerItems(slot, search),
    queryFn: async () =>
      unwrapData(await fetchOutfitPickerItems(slot, search)),
    enabled: Boolean(slot),
  });
}

export function useCreateOutfitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveOutfitInput) =>
      unwrapData(await createOutfit(input)),
    onSuccess: async () => {
      await invalidateInventoryQueries(queryClient);
      toast.success("Outfit saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save outfit");
    },
  });
}

export function useUpdateOutfitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateOutfitInput) =>
      unwrapData(await updateOutfit(input)),
    onSuccess: async () => {
      await invalidateInventoryQueries(queryClient);
      toast.success("Outfit updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update outfit");
    },
  });
}

export function useDeleteOutfitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteOutfit(id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await invalidateInventoryQueries(queryClient);
      toast.success("Outfit deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete outfit");
    },
  });
}

export function useDuplicateOutfitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrapData(await duplicateOutfit(id)),
    onSuccess: async () => {
      await invalidateInventoryQueries(queryClient);
      toast.success("Outfit duplicated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to duplicate outfit");
    },
  });
}
