"use client";

import { useQuery } from "@tanstack/react-query";

import type { IntelligenceCenterResult } from "@/domain/intelligence";
import {
  getIntelligenceCenter,
  type IntelligenceCenterFilters,
} from "@/features/intelligence/services/intelligence-center.service";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

/** The prioritised action list from the Intelligence Center (RFC-015). */
export function useIntelligenceCenter(filters: IntelligenceCenterFilters = {}) {
  return useQuery<IntelligenceCenterResult>({
    queryKey: wardrobeKeys.intelligenceCenter(filters),
    queryFn: async () => unwrapData(await getIntelligenceCenter(filters)),
  });
}
