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
  fetchWardrobeItemCodes,
  fetchWardrobeItems,
  retireWardrobeItem,
  updateWardrobeItem,
} from "@/lib/wardrobe/queries";
import {
  bulkImportJsonWardrobeItems,
  fetchImportLookups,
} from "@/lib/wardrobe/import";
import {
  fetchItemImagesForItem,
  fetchPrimaryImageUrl,
  fetchPrimaryImageUrlsForItems,
  uploadPrimaryItemImage,
} from "@/lib/wardrobe/images";
import { wardrobeKeys, type CategoryCountFilters } from "@/lib/wardrobe/query-keys";
import type {
  CreateWardrobeItemInput,
  InventoryFilters,
  JsonImportPayload,
  UpdateWardrobeItemInput,
  WardrobeItemRow,
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
    mutationFn: async (payloads: JsonImportPayload[]) =>
      unwrapData(await bulkImportJsonWardrobeItems(payloads)),
    onSuccess: async (result) => {
      await invalidateInventoryQueries(queryClient);
      if (result.imported > 0) {
        toast.success(
          `Imported ${result.imported} item${result.imported === 1 ? "" : "s"}`,
        );
      }
      if (result.failed.length > 0) {
        toast.error(
          `${result.failed.length} item${result.failed.length === 1 ? "" : "s"} failed during import`,
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to import JSON items. Please try again.");
    },
  });
}
