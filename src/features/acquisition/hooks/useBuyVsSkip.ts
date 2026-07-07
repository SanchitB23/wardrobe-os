"use client";

import { useMutation } from "@tanstack/react-query";

import type { BuyVsSkipAnalysis, ProspectiveItem } from "@/domain/acquisition";
import { analyzeBuyVsSkip } from "@/features/acquisition/services/acquisition.service";
import { unwrapData } from "@/shared/utils/data-result";

/**
 * Runs the deterministic Buy vs Skip analysis for a prospective item. A
 * mutation (not a query) — it's an explicit "Analyze" action, and the result is
 * held in component state.
 */
export function useBuyVsSkip() {
  return useMutation<BuyVsSkipAnalysis, Error, ProspectiveItem>({
    mutationFn: async (item) => unwrapData(await analyzeBuyVsSkip(item)),
  });
}
