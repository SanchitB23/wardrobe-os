"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createWardrobeItem,
  fetchCategoryCounts,
  fetchInventorySummary,
  fetchLookups,
  fetchWardrobeItems,
  retireWardrobeItem,
  updateWardrobeItem,
} from "@/lib/wardrobe/queries";
import { wardrobeKeys, type CategoryCountFilters } from "@/lib/wardrobe/query-keys";
import type {
  CreateWardrobeItemInput,
  InventoryFilters,
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
    queryFn: async () => unwrapData(await fetchWardrobeItems(filters)),
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
