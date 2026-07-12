/**
 * RFC-018C Acquisition-to-Inventory Pipeline service.
 * Orchestrates handoffs between analysis, wishlist, purchases, and inventory.
 * Does not re-score Buy vs Skip; never auto-creates inventory without confirm.
 */

import {
  assertConversionAllowed,
  mapProspectiveToInventoryDraft,
  matchLookupId,
  normalizeProspectiveItem,
  resolveDecisionActions,
  resolveDecisionLifecycle,
  type DecisionLifecycleStatus,
  type InventoryConversionDraft,
  type PipelineDecisionAction,
} from "@/domain/shopping";
import type {
  BuyVsSkipAnalysis,
  BuyVsSkipInputSource,
  ProspectiveItem,
} from "@/domain/acquisition";
import { createWardrobeItem } from "@/features/inventory/services/inventory.service";
import {
  uploadPrimaryItemImage,
  validateItemImageFile,
} from "@/features/inventory/services/images.service";
import {
  buildStoragePath,
  clearPrimaryImages,
  createSignedImageUrl,
  insertPrimaryItemImage,
  sanitizeFilename,
  uploadImageToStorage,
} from "@/features/inventory/repositories/images.repository";
import { createPurchase } from "@/features/purchases/services/purchases.service";
import { linkDecisionWishlistItem } from "@/features/shopping/repositories/decision.repository";
import {
  insertWishlist,
  patchWishlistFields,
  selectWishlistById,
} from "@/features/shopping/repositories/shopping.repository";
import type {
  AcquisitionDecisionRecord,
  WishlistItem,
} from "@/features/shopping/types";
import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type {
  CreateWardrobeItemInput,
  FormalityEnum,
  WardrobeLookups,
} from "@/types/wardrobe";
import { WARDROBE_IMAGES_BUCKET } from "@/types/wardrobe";

type Result<T> = { data: T | null; error: Error | null };

export interface ImageCandidate {
  file?: File | null;
  url?: string | null;
  storagePath?: string | null;
}

export interface AddAnalysisToWishlistInput {
  decisionId?: string | null;
  item: ProspectiveItem;
  source: BuyVsSkipInputSource;
  imageCandidate?: ImageCandidate | null;
  notes?: string | null;
}

export interface MarkWishlistPurchasedInput {
  wishlistId: string;
  purchasePrice: number;
  purchaseDate: string;
}

export interface ConvertWishlistToInventoryInput {
  wishlistId: string;
  draft: CreateWardrobeItemInput;
  attachImage: boolean;
  /** Must be true — inventory is never auto-created. */
  confirmed: true;
  /** Optional override file (e.g. still in memory from screenshot). */
  imageFile?: File | null;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
}

export interface ConvertWishlistToInventoryResult {
  itemId: string;
  purchaseId: string | null;
  wishlist: WishlistItem;
  imageAttached: boolean;
}

export interface DecisionCardModel {
  decision: AcquisitionDecisionRecord;
  source: BuyVsSkipInputSource;
  wishlistItemId: string | null;
  wishlistItemName: string | null;
  inventoryItemId: string | null;
  wishlistStatus: WishlistItem["status"] | null;
  imageUrl: string | null;
  wears: number;
  costPerWear: number | null;
  lifecycleStatus: DecisionLifecycleStatus;
  actions: PipelineDecisionAction[];
}

export type DecisionWearStats = {
  wears: number;
  costPerWear: number | null;
};

function snapshotImageUrl(item: ProspectiveItem): string | null {
  const url = item.imagePreviewUrl;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

export function buildDecisionCardModel(
  decision: AcquisitionDecisionRecord,
  wishlistById: Map<string, WishlistItem>,
  wearByInventoryId: Map<string, DecisionWearStats> = new Map(),
): DecisionCardModel {
  const wishlist = decision.wishlistItemId
    ? (wishlistById.get(decision.wishlistItemId) ?? null)
    : null;
  const inventoryItemId = wishlist?.inventoryItemId ?? null;
  const wear = inventoryItemId
    ? (wearByInventoryId.get(inventoryItemId) ?? { wears: 0, costPerWear: null })
    : { wears: 0, costPerWear: null };
  const ctx = {
    wishlistItemId: decision.wishlistItemId,
    wishlistStatus: wishlist?.status ?? null,
    inventoryItemId,
    wears: wear.wears,
    costPerWear: wear.costPerWear,
  };
  return {
    decision,
    source: decision.source,
    wishlistItemId: decision.wishlistItemId,
    wishlistItemName: wishlist?.item.name ?? null,
    inventoryItemId,
    wishlistStatus: wishlist?.status ?? null,
    imageUrl:
      wishlist?.imageUrl ??
      snapshotImageUrl(decision.itemSnapshot) ??
      null,
    wears: wear.wears,
    costPerWear: wear.costPerWear,
    lifecycleStatus: resolveDecisionLifecycle(ctx),
    actions: resolveDecisionActions(ctx),
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function uploadWishlistCandidateImage(
  wishlistId: string,
  file: File,
): Promise<Result<{ storagePath: string; imageUrl: string }>> {
  const validation = validateItemImageFile(file);
  if (!validation.valid) {
    return { data: null, error: toError(validation.message) };
  }
  const storagePath = `wishlist-candidates/${wishlistId}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const uploadError = await uploadImageToStorage(storagePath, file);
  if (uploadError) return { data: null, error: uploadError };
  const signed = await createSignedImageUrl(storagePath);
  return {
    data: { storagePath, imageUrl: signed ?? storagePath },
    error: null,
  };
}

/**
 * Durable preview for Decision History when analysis source is image and the
 * decision is not yet linked to a wishlist. Stores under decision-previews/.
 * Does not affect Buy vs Skip scoring.
 */
export async function uploadDecisionPreviewImage(
  file: File,
): Promise<Result<{ storagePath: string; imageUrl: string }>> {
  const validation = validateItemImageFile(file);
  if (!validation.valid) {
    return { data: null, error: toError(validation.message) };
  }
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const storagePath = `decision-previews/${id}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const uploadError = await uploadImageToStorage(storagePath, file);
  if (uploadError) return { data: null, error: uploadError };
  const signed = await createSignedImageUrl(storagePath);
  return {
    data: { storagePath, imageUrl: signed ?? storagePath },
    error: null,
  };
}

/**
 * Attach wishlist candidate image as primary inventory image.
 * Prefers storage copy within the same bucket when a path exists; otherwise
 * uploads from File / fetches remote URL.
 */
async function attachCandidateImageToItem(input: {
  itemId: string;
  wishlist: WishlistItem;
  imageFile?: File | null;
}): Promise<Result<boolean>> {
  const { itemId, wishlist, imageFile } = input;

  if (imageFile) {
    const uploaded = await uploadPrimaryItemImage(itemId, imageFile);
    if (uploaded.error) return { data: false, error: uploaded.error };
    return { data: Boolean(uploaded.data), error: null };
  }

  if (wishlist.imageStoragePath) {
    const destPath = buildStoragePath(itemId, "primary.jpg");
    const supabase = createClient();
    const { error: copyError } = await supabase.storage
      .from(WARDROBE_IMAGES_BUCKET)
      .copy(wishlist.imageStoragePath, destPath);
    if (!copyError) {
      const clearError = await clearPrimaryImages(itemId);
      if (clearError) return { data: false, error: clearError };
      const inserted = await insertPrimaryItemImage(itemId, destPath);
      if (inserted.error) return { data: false, error: inserted.error };
      return { data: true, error: null };
    }
    // Fall through to download+reupload if copy is unsupported / fails.
  }

  if (wishlist.imageUrl) {
    try {
      const response = await fetch(wishlist.imageUrl);
      if (!response.ok) {
        return {
          data: false,
          error: toError("Could not fetch wishlist image."),
        };
      }
      const blob = await response.blob();
      const file = new File(
        [blob],
        sanitizeFilename(wishlist.item.name || "product") + ".jpg",
        { type: blob.type || "image/jpeg" },
      );
      const uploaded = await uploadPrimaryItemImage(itemId, file);
      if (uploaded.error) return { data: false, error: uploaded.error };
      return { data: Boolean(uploaded.data), error: null };
    } catch (err) {
      return {
        data: false,
        error: toError(
          err instanceof Error ? err.message : "Image attach failed.",
        ),
      };
    }
  }

  return { data: false, error: null };
}

export async function addAnalysisToWishlist(
  input: AddAnalysisToWishlistInput,
): Promise<Result<WishlistItem>> {
  if (input.decisionId) {
    const existingLink = await selectWishlistForDecision(input.decisionId);
    if (existingLink.data) return { data: existingLink.data, error: null };
    if (existingLink.error && !existingLink.error.message.includes("not linked")) {
      // Non-fatal — continue to create.
    }
  }

  const created = await insertWishlist({
    item: normalizeProspectiveItem(input.item),
    source: input.source,
    sourceUrl: input.item.productUrl ?? null,
    imageUrl: input.imageCandidate?.url ?? null,
    imageStoragePath: input.imageCandidate?.storagePath ?? null,
    notes: input.notes ?? input.item.notes ?? null,
    status: "active",
  });
  if (created.error || !created.data) {
    return {
      data: null,
      error: created.error ?? toError("Failed to create wishlist item."),
    };
  }

  let wishlist = created.data;

  if (input.imageCandidate?.file) {
    const uploaded = await uploadWishlistCandidateImage(
      wishlist.id,
      input.imageCandidate.file,
    );
    if (uploaded.data) {
      const patched = await patchWishlistFields(wishlist.id, {
        imageUrl: uploaded.data.imageUrl,
        imageStoragePath: uploaded.data.storagePath,
      });
      if (patched.data) wishlist = patched.data;
    }
  }

  if (input.decisionId) {
    const linked = await linkDecisionWishlistItem(
      input.decisionId,
      wishlist.id,
    );
    if (linked.error) {
      return { data: wishlist, error: linked.error };
    }
  }

  return { data: wishlist, error: null };
}

async function selectWishlistForDecision(
  decisionId: string,
): Promise<Result<WishlistItem>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("acquisition_decisions")
    .select("wishlist_item_id")
    .eq("id", decisionId)
    .single();
  if (error) return { data: null, error: toError(error.message) };
  const wishlistItemId = (data as { wishlist_item_id: string | null } | null)
    ?.wishlist_item_id;
  if (!wishlistItemId) {
    return { data: null, error: toError("Decision not linked.") };
  }
  return selectWishlistById(wishlistItemId);
}

export async function markWishlistPurchased(
  input: MarkWishlistPurchasedInput,
): Promise<Result<WishlistItem>> {
  if (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0) {
    return { data: null, error: toError("Purchase price is required.") };
  }
  if (!input.purchaseDate?.trim()) {
    return { data: null, error: toError("Purchase date is required.") };
  }
  const existing = await selectWishlistById(input.wishlistId);
  if (existing.error || !existing.data) {
    return {
      data: null,
      error: existing.error ?? toError("Wishlist item not found."),
    };
  }
  if (existing.data.inventoryItemId) {
    return {
      data: existing.data,
      error: toError("Item is already in inventory."),
    };
  }
  return patchWishlistFields(input.wishlistId, {
    status: "purchased",
    purchasePrice: input.purchasePrice,
    purchaseDate: input.purchaseDate.slice(0, 10),
  });
}

/**
 * Ensure a wishlist row exists for pipeline CTAs (Mark Purchased / Convert).
 * Idempotent when decisionId already linked.
 */
export async function ensureWishlistForAnalysis(input: {
  decisionId?: string | null;
  item: ProspectiveItem;
  source: BuyVsSkipInputSource;
  imageCandidate?: ImageCandidate | null;
}): Promise<Result<WishlistItem>> {
  return addAnalysisToWishlist(input);
}

export function buildInventoryDraftFromWishlist(
  wishlist: WishlistItem,
  lookups?: WardrobeLookups,
  nowMs?: number,
): {
  draft: InventoryConversionDraft;
  form: CreateWardrobeItemInput;
} {
  const draft = mapProspectiveToInventoryDraft(wishlist.item, {
    imageUrl: wishlist.imageUrl,
    nowMs,
  });
  const categoryId = lookups
    ? matchLookupId(draft.categoryText, lookups.categories)
    : null;
  const subcategoryId = lookups
    ? matchLookupId(
        draft.subcategoryText,
        lookups.subcategories.filter(
          (s) => !categoryId || s.category_id === categoryId,
        ),
      )
    : null;
  const brandId = lookups
    ? matchLookupId(draft.brandText, lookups.brands)
    : null;
  const colorId = lookups
    ? matchLookupId(draft.colorText, lookups.colors)
    : null;

  const formality =
    draft.formality &&
    (
      [
        "casual",
        "smart_casual",
        "business_casual",
        "business_formal",
        "formal",
      ] as const
    ).includes(draft.formality as FormalityEnum)
      ? (draft.formality as FormalityEnum)
      : null;

  const notesParts = [
    draft.notes,
    draft.materialText ? `Material: ${draft.materialText}` : null,
    draft.styleTags.length > 0
      ? `Style tags: ${draft.styleTags.join(", ")}`
      : null,
    draft.occasionText ? `Occasion: ${draft.occasionText}` : null,
  ].filter(Boolean);

  const form: CreateWardrobeItemInput = {
    code: draft.code,
    name: draft.name,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    brand_id: brandId,
    primary_color_id: colorId,
    status: "active",
    ownership: "owned",
    fit: "unknown",
    formality,
    rating: null,
    usage: null,
    notes: notesParts.length > 0 ? notesParts.join("\n") : null,
  };

  return { draft, form };
}

export async function convertWishlistToInventory(
  input: ConvertWishlistToInventoryInput,
): Promise<Result<ConvertWishlistToInventoryResult>> {
  if (!input.confirmed) {
    return {
      data: null,
      error: toError("Confirmation required before creating inventory."),
    };
  }

  const existing = await selectWishlistById(input.wishlistId);
  if (existing.error || !existing.data) {
    return {
      data: null,
      error: existing.error ?? toError("Wishlist item not found."),
    };
  }
  const wishlist = existing.data;

  const guard = assertConversionAllowed({
    inventoryItemId: wishlist.inventoryItemId,
    status: wishlist.status,
  });
  if (!guard.ok) {
    return {
      data: null,
      error: toError(
        guard.inventoryItemId
          ? `${guard.reason} Open /inventory/${guard.inventoryItemId}`
          : guard.reason,
      ),
    };
  }

  const created = await createWardrobeItem(input.draft);
  if (created.error || !created.data) {
    return {
      data: null,
      error: created.error ?? toError("Failed to create inventory item."),
    };
  }
  const itemId = created.data.id;

  let imageAttached = false;
  if (input.attachImage) {
    const attached = await attachCandidateImageToItem({
      itemId,
      wishlist,
      imageFile: input.imageFile,
    });
    if (attached.error) {
      // Item exists — surface error but still attempt purchase link.
      console.warn("[018C] image attach failed:", attached.error.message);
    } else {
      imageAttached = Boolean(attached.data);
    }
  }

  const price =
    input.purchasePrice ??
    wishlist.purchasePrice ??
    wishlist.item.estimatedPrice ??
    0;
  const purchaseDate =
    input.purchaseDate ?? wishlist.purchaseDate ?? todayIsoDate();

  const purchase = await createPurchase({
    item_id: itemId,
    purchase_date: purchaseDate,
    price,
    source: wishlist.source,
    status: "active",
  });

  const patched = await patchWishlistFields(wishlist.id, {
    status: "purchased",
    inventoryItemId: itemId,
    purchasedId: purchase.data?.id ?? null,
    purchasePrice: price,
    purchaseDate,
  });

  return {
    data: {
      itemId,
      purchaseId: purchase.data?.id ?? null,
      wishlist: patched.data ?? {
        ...wishlist,
        status: "purchased",
        inventoryItemId: itemId,
        purchasedId: purchase.data?.id ?? null,
        purchasePrice: price,
        purchaseDate,
      },
      imageAttached,
    },
    error: purchase.error
      ? toError(
          `Inventory created, but purchase link failed: ${purchase.error.message}`,
        )
      : patched.error,
  };
}

/** Re-export draft helper for UI tests. */
export function draftFromProspective(
  item: ProspectiveItem,
  imageUrl?: string | null,
): InventoryConversionDraft {
  return mapProspectiveToInventoryDraft(item, { imageUrl });
}

export type { BuyVsSkipAnalysis };
