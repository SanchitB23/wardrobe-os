import {
  buildWardrobeItemInsert,
  deleteAllItemRelations,
  deleteWardrobeItemById,
  insertJsonItemRelations,
  insertWardrobeItemForSync,
  selectWardrobeItemIdByCode,
  updateWardrobeItemByCode,
} from "@/features/inventory/repositories/json-sync.repository";
import type { JsonBulkImportResult, JsonImportPayload } from "@/features/inventory/types";

export type JsonSyncItemResult =
  | { status: "inserted"; code: string }
  | { status: "updated"; code: string }
  | { status: "failed"; code: string; error: string };

export async function syncJsonWardrobeItem(
  payload: JsonImportPayload,
): Promise<JsonSyncItemResult> {
  const code = payload.item.code.trim();
  const existing = await selectWardrobeItemIdByCode(code);

  if (existing.error) {
    return { status: "failed", code, error: existing.error.message };
  }

  if (existing.id) {
    const itemId = existing.id;
    const updateError = await updateWardrobeItemByCode(
      itemId,
      buildWardrobeItemInsert(payload.item),
    );

    if (updateError) {
      return {
        status: "failed",
        code,
        error: updateError.message,
      };
    }

    const deleteRelationsError = await deleteAllItemRelations(itemId);
    if (deleteRelationsError) {
      return {
        status: "failed",
        code,
        error: deleteRelationsError.message,
      };
    }

    const insertRelationsError = await insertJsonItemRelations(itemId, payload);
    if (insertRelationsError) {
      return {
        status: "failed",
        code,
        error: insertRelationsError.message,
      };
    }

    return { status: "updated", code };
  }

  const insertResult = await insertWardrobeItemForSync(
    buildWardrobeItemInsert(payload.item),
  );

  if (insertResult.error || !insertResult.id) {
    return {
      status: "failed",
      code,
      error: insertResult.error?.message ?? "Failed to create wardrobe item.",
    };
  }

  const relationError = await insertJsonItemRelations(insertResult.id, payload);
  if (relationError) {
    await deleteWardrobeItemById(insertResult.id);
    return {
      status: "failed",
      code,
      error: relationError.message,
    };
  }

  return { status: "inserted", code };
}

export type JsonSyncInput = {
  payloads: JsonImportPayload[];
  skipped?: number;
};

export async function bulkSyncJsonWardrobeItems(
  input: JsonSyncInput,
): Promise<{ data: JsonBulkImportResult | null; error: Error | null }> {
  const { payloads, skipped = 0 } = input;

  if (payloads.length === 0) {
    return {
      data: { inserted: 0, updated: 0, failed: [], skipped },
      error: null,
    };
  }

  const failed: { code: string; error: string }[] = [];
  let inserted = 0;
  let updated = 0;

  // Process items with bounded concurrency instead of fully sequentially
  // (RFC-009/M5): each payload is a distinct item (distinct code) with no
  // cross-item contention, so this cuts wall-clock on large imports without
  // changing per-item logic. Results are kept index-ordered for a stable report.
  const CONCURRENCY = 5;
  const results = new Array<Awaited<ReturnType<typeof syncJsonWardrobeItem>>>(
    payloads.length,
  );
  let cursor = 0;
  async function worker() {
    for (let i = cursor++; i < payloads.length; i = cursor++) {
      results[i] = await syncJsonWardrobeItem(payloads[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, payloads.length) }, worker),
  );

  for (const result of results) {
    switch (result.status) {
      case "inserted":
        inserted += 1;
        break;
      case "updated":
        updated += 1;
        break;
      case "failed":
        failed.push({
          code: result.code,
          error: result.error,
        });
        break;
      default: {
        const _exhaustive: never = result;
        return _exhaustive;
      }
    }
  }

  return {
    data: { inserted, updated, failed, skipped },
    error: null,
  };
}
