/**
 * Decision History service — list/filter/search + insert for Acquisitions hub.
 * Silent persist from Buy vs Skip uses `recordDecision` (best-effort).
 */

import type {
  BuyVsSkipAnalysis,
  BuyVsSkipInputSource,
  ProspectiveItem,
} from "@/domain/acquisition";
import {
  filterDecisions,
  insertDecision,
  selectDecisions,
} from "@/features/shopping/repositories/decision.repository";
import type {
  AcquisitionDecisionRecord,
  DecisionListFilters,
} from "@/features/shopping/types";

type Result<T> = { data: T | null; error: Error | null };

export function listDecisions(
  filters: DecisionListFilters = {},
): Promise<Result<AcquisitionDecisionRecord[]>> {
  return selectDecisions(filters);
}

export function saveDecision(input: {
  item: ProspectiveItem;
  analysis: BuyVsSkipAnalysis;
  source?: BuyVsSkipInputSource;
  wishlistItemId?: string | null;
}): Promise<Result<AcquisitionDecisionRecord>> {
  return insertDecision(input);
}

/**
 * Best-effort persist after a successful Buy vs Skip run. Never throws; never
 * fails the analysis path. Advisor/screenshot UX stays unchanged.
 */
export async function recordDecisionSilent(input: {
  item: ProspectiveItem;
  analysis: BuyVsSkipAnalysis;
  source?: BuyVsSkipInputSource;
  wishlistItemId?: string | null;
}): Promise<void> {
  try {
    const result = await insertDecision(input);
    if (result.error) {
      console.warn(
        "[acquisitions] decision history write failed:",
        result.error.message,
      );
    }
  } catch (err) {
    console.warn("[acquisitions] decision history write failed:", err);
  }
}

/** Re-export pure filter for tests / client-side refinement. */
export { filterDecisions };
