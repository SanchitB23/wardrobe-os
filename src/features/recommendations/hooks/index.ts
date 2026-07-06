"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { RecommendedOutfitItem } from "@/domain/recommendation";
import {
  fetchOutfitRecommendations,
  saveGeneratedOutfit,
  wearOutfitToday,
  type RecommendationFilters,
} from "@/features/recommendations/services/recommendations.service";
import { invalidateWardrobeQueries } from "@/shared/hooks/invalidate-wardrobe-queries";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

export function useOutfitRecommendations(filters: RecommendationFilters) {
  return useQuery({
    queryKey: wardrobeKeys.recommendations(filters),
    queryFn: async () => unwrapData(await fetchOutfitRecommendations(filters)),
  });
}

export function useSaveGeneratedOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { items: RecommendedOutfitItem[]; name?: string }) =>
      unwrapData(await saveGeneratedOutfit(input.items, input.name)),
    onSuccess: async () => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Outfit saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save outfit");
    },
  });
}

export function useWearOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemIds: string[]; outfitId?: string | null }) => {
      const result = await wearOutfitToday(input.itemIds, input.outfitId);
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Logged today's wear");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log wear");
    },
  });
}

export type {
  RecommendationFilters,
  RecommendationCenterData,
  RecommendationContextSummary,
  ItemPreview,
} from "@/features/recommendations/services/recommendations.service";
