/**
 * Decision History repository — the only code touching `acquisition_decisions`.
 * Persists Buy vs Skip analysis snapshots for the Acquisitions hub. No domain
 * logic; maps rows ⇄ `AcquisitionDecisionRecord`.
 */

import type {
  BuyDecision,
  BuyVsSkipAnalysis,
  BuyVsSkipInputSource,
  ProspectiveItem,
} from "@/domain/acquisition";
import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type {
  AcquisitionDecisionRecord,
  DecisionListFilters,
} from "@/features/shopping/types";
import type { Json } from "@/types/database";

type Result<T> = { data: T | null; error: Error | null };

type DecisionRow = {
  id: string;
  item_name: string;
  item_category: string | null;
  item_snapshot: unknown;
  decision: string;
  score: number | null;
  confidence: number | null;
  summary: string | null;
  analysis: unknown;
  source: string;
  wishlist_item_id: string | null;
  created_at: string;
};

function toRecord(row: DecisionRow): AcquisitionDecisionRecord {
  return {
    id: row.id,
    itemName: row.item_name,
    itemCategory: row.item_category,
    itemSnapshot: (row.item_snapshot ?? {}) as ProspectiveItem,
    decision: row.decision as BuyDecision,
    score: row.score,
    confidence: row.confidence,
    summary: row.summary,
    analysis: row.analysis as BuyVsSkipAnalysis,
    source: row.source as BuyVsSkipInputSource,
    wishlistItemId: row.wishlist_item_id,
    createdAt: row.created_at,
  };
}

export interface InsertDecisionInput {
  item: ProspectiveItem;
  analysis: BuyVsSkipAnalysis;
  source?: BuyVsSkipInputSource;
  wishlistItemId?: string | null;
}

export async function insertDecision(
  input: InsertDecisionInput,
): Promise<Result<AcquisitionDecisionRecord>> {
  const supabase = createClient();
  const { item, analysis } = input;
  const { data, error } = await supabase
    .from("acquisition_decisions")
    .insert({
      item_name: item.name,
      item_category: item.category || null,
      item_snapshot: item as unknown as Json,
      decision: analysis.decision,
      score: analysis.score,
      confidence: analysis.confidence,
      summary: analysis.summary,
      analysis: analysis as unknown as Json,
      source: input.source ?? analysis.metadata.inputSource ?? "manual",
      wishlist_item_id: input.wishlistItemId ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    return {
      data: null,
      error: toError(error?.message ?? "Failed to save decision."),
    };
  }
  return { data: toRecord(data as DecisionRow), error: null };
}

/** Client-side filter/search over a fetched list (used by service + tests). */
export function filterDecisions(
  records: AcquisitionDecisionRecord[],
  filters: DecisionListFilters = {},
): AcquisitionDecisionRecord[] {
  const decision =
    filters.decision && filters.decision !== "all" ? filters.decision : null;
  const search = filters.search?.trim().toLowerCase() ?? "";
  const from = filters.from?.trim() || null;
  const to = filters.to?.trim() || null;

  return records.filter((r) => {
    if (decision && r.decision !== decision) return false;
    if (search) {
      const hay =
        `${r.itemName} ${r.itemCategory ?? ""} ${r.summary ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    const day = r.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
}

export async function selectDecisions(
  filters: DecisionListFilters = {},
): Promise<Result<AcquisitionDecisionRecord[]>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("acquisition_decisions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: toError(error.message) };
  const all = ((data ?? []) as DecisionRow[]).map(toRecord);
  return { data: filterDecisions(all, filters), error: null };
}
