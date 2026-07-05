"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchWardrobeDashboardAnalytics } from "@/features/dashboard/services/analytics.service";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

export function useWardrobeDashboard() {
  return useQuery({
    queryKey: wardrobeKeys.dashboard(),
    queryFn: async () => unwrapData(await fetchWardrobeDashboardAnalytics()),
  });
}
