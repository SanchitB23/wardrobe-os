"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createPurchase,
  fetchItemPurchaseDetail,
  fetchPurchaseChartData,
  fetchPurchases,
  updatePurchase,
} from "@/features/purchases/services/purchases.service";
import type {
  CreatePurchaseInput,
  PurchaseFilters,
  UpdatePurchaseInput,
} from "@/features/purchases/types";
import { invalidateWardrobeQueries } from "@/shared/hooks/invalidate-wardrobe-queries";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

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
      await invalidateWardrobeQueries(queryClient);
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
      await invalidateWardrobeQueries(queryClient);
      toast.success("Purchase updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update purchase");
    },
  });
}
