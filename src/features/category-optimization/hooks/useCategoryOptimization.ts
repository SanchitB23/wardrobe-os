"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ReplacementOpportunity } from "@/domain/category-optimization";
import {
  confirmWishlistFromOpportunity,
  getCategoryOptimization,
} from "@/features/category-optimization/services/category-optimization.service";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

export function useCategoryOptimization(
  categoryKey: string | null,
  focusItemId?: string | null,
) {
  return useQuery({
    queryKey: [
      "category-optimization",
      categoryKey ?? "",
      focusItemId ?? "",
    ] as const,
    enabled: Boolean(categoryKey && categoryKey.trim()),
    queryFn: async () =>
      unwrapData(
        await getCategoryOptimization({
          categoryKey: categoryKey!,
          focusItemId: focusItemId ?? undefined,
        }),
      ),
  });
}

export function useConfirmReplacementWishlistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (opportunity: ReplacementOpportunity) =>
      unwrapData(await confirmWishlistFromOpportunity(opportunity)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wardrobeKeys.wishlist() });
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.acquisitionsHub(),
      });
    },
  });
}
