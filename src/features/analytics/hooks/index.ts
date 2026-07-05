"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchInsightReport,
  fetchUsageAnalytics,
  fetchWardrobeHealth,
} from "@/features/analytics/services/analytics.service";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

export function useWardrobeHealth() {
  return useQuery({
    queryKey: wardrobeKeys.wardrobeHealth(),
    queryFn: async () => unwrapData(await fetchWardrobeHealth()),
  });
}

export function useUsageAnalytics() {
  return useQuery({
    queryKey: wardrobeKeys.usageAnalytics(),
    queryFn: async () => unwrapData(await fetchUsageAnalytics()),
  });
}

export function useInsightReport() {
  return useQuery({
    queryKey: wardrobeKeys.insights(),
    queryFn: async () => unwrapData(await fetchInsightReport()),
  });
}

export type { WardrobeHealthReport } from "@/features/analytics/services/analytics.service";
