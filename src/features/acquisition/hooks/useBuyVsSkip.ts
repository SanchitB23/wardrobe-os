"use client";

import { useMutation } from "@tanstack/react-query";

import type {
  BuyVsSkipAnalysis,
  BuyVsSkipInputSource,
  ProspectiveItem,
} from "@/domain/acquisition";
import { analyzeBuyVsSkip } from "@/features/acquisition/services/acquisition.service";
import { unwrapData } from "@/shared/utils/data-result";

export type AnalyzeBuyVsSkipVariables =
  | ProspectiveItem
  | {
      item: ProspectiveItem;
      inputSource?: BuyVsSkipInputSource;
      wishlistItemId?: string | null;
    };

export type AnalyzeBuyVsSkipResult = {
  analysis: BuyVsSkipAnalysis;
  decisionId: string | null;
};

function normalizeVariables(variables: AnalyzeBuyVsSkipVariables): {
  item: ProspectiveItem;
  inputSource?: BuyVsSkipInputSource;
  wishlistItemId?: string | null;
} {
  if ("name" in variables && "category" in variables) {
    return { item: variables };
  }
  return variables;
}

/**
 * Runs the deterministic Buy vs Skip analysis for a prospective item. A
 * mutation (not a query) — it's an explicit "Analyze" action, and the result is
 * held in component state. Optional `inputSource` tags Decision History
 * (screenshot → `"image"`).
 */
export function useBuyVsSkip() {
  return useMutation<AnalyzeBuyVsSkipResult, Error, AnalyzeBuyVsSkipVariables>({
    mutationFn: async (variables) => {
      const { item, inputSource, wishlistItemId } =
        normalizeVariables(variables);
      const result = await analyzeBuyVsSkip(item, {
        inputSource,
        wishlistItemId,
      });
      const analysis = unwrapData({ data: result.data, error: result.error });
      return { analysis, decisionId: result.decisionId };
    },
  });
}
