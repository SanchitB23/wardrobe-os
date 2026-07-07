"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  RecommendedOutfitItem,
  UnifiedOutfitRecommendation,
} from "@/domain/recommendation";
import {
  buildExplanationInput,
  explanationCacheKey,
} from "@/features/recommendations/ai/explanation-input";
import type { ExplainSharedContext } from "@/features/recommendations/ai/explanation.types";
import { fetchRecommendationExplanation } from "@/features/recommendations/services/recommendation-explanation.client";
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
    onSuccess: async (data) => {
      await invalidateWardrobeQueries(queryClient);
      if (data.duplicate) {
        toast.info("This outfit is already saved");
      } else {
        toast.success("Outfit saved");
      }
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

/**
 * Lazily loads an AI explanation for a single recommendation. The query stays
 * disabled until `enabled` flips true (the user clicks ✨ Explain), then caches
 * the result forever keyed by the recommendation's deterministic cache key — so
 * it is not regenerated unless the recommendation itself changes. `retry: false`
 * lets the UI fall back gracefully on failure.
 */
export function useRecommendationExplanation(
  recommendation: UnifiedOutfitRecommendation,
  shared: ExplainSharedContext | undefined,
  enabled: boolean,
) {
  const input = shared
    ? buildExplanationInput(recommendation, shared)
    : null;
  return useQuery({
    queryKey: wardrobeKeys.recommendationExplanation(
      input ? explanationCacheKey(input) : recommendation.id,
    ),
    queryFn: ({ signal }) => fetchRecommendationExplanation(input!, signal),
    enabled: enabled && input !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // keep for the session
  });
}

export type {
  RecommendationFilters,
  RecommendationCenterData,
  RecommendationContextSummary,
  ItemPreview,
} from "@/features/recommendations/services/recommendations.service";
