"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchWardrobeHealth } from "@/features/analytics/services/analytics.service";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

export function useWardrobeHealth() {
  return useQuery({
    queryKey: wardrobeKeys.wardrobeHealth(),
    queryFn: async () => unwrapData(await fetchWardrobeHealth()),
  });
}

export type { WardrobeHealthReport } from "@/features/analytics/services/analytics.service";
