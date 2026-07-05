"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createOutfitWearLogs,
  createWearLog,
  deleteWearLog,
  fetchItemWearSummary,
  fetchOccasions,
  fetchWearLogs,
} from "@/features/wear-logs/services/wear-logs.service";
import { invalidateWardrobeQueries } from "@/shared/hooks/invalidate-wardrobe-queries";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";
import type {
  CreateWearLogInput,
  WearLogFilters,
  WearOutfitInput,
} from "@/types/wardrobe";

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
      await invalidateWardrobeQueries(queryClient);
      toast.success("Wear logged");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log wear");
    },
  });
}

export function useWearOutfitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: WearOutfitInput) =>
      unwrapData(await createOutfitWearLogs(input)),
    onSuccess: async (logs) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(
        `Logged wear for ${logs.length} item${logs.length === 1 ? "" : "s"}`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log outfit wear");
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
      await invalidateWardrobeQueries(queryClient);
      toast.success("Wear log deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete wear log");
    },
  });
}
