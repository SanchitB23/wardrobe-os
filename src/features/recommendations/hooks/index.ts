"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchOutfitRecommendations,
  type RecommendationFilters,
} from "@/features/recommendations/services/recommendations.service";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

export function useOutfitRecommendations(filters: RecommendationFilters) {
  return useQuery({
    queryKey: wardrobeKeys.recommendations(filters),
    queryFn: async () => unwrapData(await fetchOutfitRecommendations(filters)),
  });
}

export type {
  RecommendationFilters,
  RecommendationCenterData,
  RecommendationContextSummary,
  ItemPreview,
} from "@/features/recommendations/services/recommendations.service";
