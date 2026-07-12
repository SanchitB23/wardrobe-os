/**
 * RFC-018C Acquisition-to-Inventory Pipeline — pure helpers.
 * Prefill mapping, conversion guards, decision card actions / lifecycle.
 * No I/O; no Buy vs Skip scoring.
 */

import type {
  BuyDecision,
  BuyVsSkipInputSource,
  ProspectiveItem,
} from "@/domain/acquisition";

export type DecisionLifecycleStatus =
  | "analyzed"
  | "on_wishlist"
  | "purchased"
  | "in_inventory"
  | "worn"
  | "roi";

export type PipelineDecisionAction =
  | "add_to_wishlist"
  | "view_wishlist"
  | "mark_purchased"
  | "convert_to_inventory"
  | "view_inventory";

/** Prefill DTO toward CreateWardrobeItemInput (IDs resolved in the service/UI). */
export interface InventoryConversionDraft {
  code: string;
  name: string;
  categoryText: string | null;
  subcategoryText: string | null;
  brandText: string | null;
  colorText: string | null;
  materialText: string | null;
  styleTags: string[];
  /** Inventory formality enum string when mappable; else null. */
  formality: string | null;
  occasionText: string | null;
  notes: string | null;
  estimatedPrice: number | null;
  imageUrl: string | null;
}

export interface ConversionGuardInput {
  inventoryItemId: string | null;
  status: "active" | "purchased" | "dismissed";
}

export type ConversionGuardResult =
  | { ok: true }
  | { ok: false; reason: string; inventoryItemId?: string };

const FORMALITY_VALUES = [
  "casual",
  "smart_casual",
  "business_casual",
  "business_formal",
  "formal",
] as const;

function slugCode(name: string, nowMs: number): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const suffix = nowMs.toString(36).slice(-4);
  return `acq-${base || "item"}-${suffix}`;
}

export function mapFormalityText(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, (typeof FORMALITY_VALUES)[number]> = {
    smart_casual: "smart_casual",
    business_casual: "business_casual",
    business_formal: "business_formal",
    business: "business_formal",
    black_tie: "formal",
  };
  const mapped = aliases[normalized] ?? normalized;
  return (FORMALITY_VALUES as readonly string[]).includes(mapped)
    ? mapped
    : null;
}

/** Deterministic prefill from ProspectiveItem (+ optional image URL). */
export function mapProspectiveToInventoryDraft(
  item: ProspectiveItem,
  options?: { imageUrl?: string | null; nowMs?: number },
): InventoryConversionDraft {
  const nowMs = options?.nowMs ?? Date.now();
  return {
    code: slugCode(item.name, nowMs),
    name: item.name.trim(),
    categoryText: item.category?.trim() || null,
    subcategoryText: item.subcategory?.trim() || null,
    brandText: item.brand?.trim() || null,
    colorText: item.color?.trim() || null,
    materialText: item.material?.trim() || null,
    styleTags: item.styleTags ?? [],
    formality: mapFormalityText(item.formality),
    occasionText: item.intendedOccasions?.[0]?.trim() || null,
    notes: item.notes?.trim() || null,
    estimatedPrice:
      typeof item.estimatedPrice === "number" ? item.estimatedPrice : null,
    imageUrl: options?.imageUrl ?? null,
  };
}

export function assertConversionAllowed(
  input: ConversionGuardInput,
): ConversionGuardResult {
  if (input.inventoryItemId) {
    return {
      ok: false,
      reason: "Already converted to inventory.",
      inventoryItemId: input.inventoryItemId,
    };
  }
  if (input.status === "dismissed") {
    return {
      ok: false,
      reason: "Dismissed wishlist items cannot be converted.",
    };
  }
  return { ok: true };
}

export interface DecisionCardContext {
  wishlistItemId: string | null;
  wishlistStatus: "active" | "purchased" | "dismissed" | null;
  inventoryItemId: string | null;
  wears?: number;
  costPerWear?: number | null;
}

export function resolveDecisionLifecycle(
  ctx: DecisionCardContext,
): DecisionLifecycleStatus {
  if (ctx.inventoryItemId) {
    if ((ctx.wears ?? 0) >= 1 && ctx.costPerWear != null) return "roi";
    if ((ctx.wears ?? 0) >= 1) return "worn";
    return "in_inventory";
  }
  if (ctx.wishlistStatus === "purchased") return "purchased";
  if (ctx.wishlistItemId) return "on_wishlist";
  return "analyzed";
}

export function resolveDecisionActions(
  ctx: DecisionCardContext,
): PipelineDecisionAction[] {
  if (ctx.inventoryItemId) return ["view_inventory", "view_wishlist"];
  if (ctx.wishlistStatus === "purchased") {
    return ["view_wishlist", "convert_to_inventory"];
  }
  if (ctx.wishlistItemId) {
    return ["view_wishlist", "mark_purchased", "convert_to_inventory"];
  }
  return ["add_to_wishlist", "mark_purchased", "convert_to_inventory"];
}

export interface DecisionCardFilters {
  decision?: BuyDecision | "all";
  source?: BuyVsSkipInputSource | "all";
  linkage?: "all" | "linked" | "unlinked";
  highScore?: boolean;
  /** When true, sort by score desc; otherwise recent (caller sorts by createdAt). */
  sort?: "recent" | "high_score";
  search?: string;
  from?: string | null;
  to?: string | null;
}

export interface DecisionCardFilterable {
  decision: BuyDecision;
  source: BuyVsSkipInputSource;
  wishlistItemId: string | null;
  score: number | null;
  itemName: string;
  summary: string | null;
  createdAt: string;
}

export function filterDecisionCards<T extends DecisionCardFilterable>(
  records: T[],
  filters: DecisionCardFilters = {},
): T[] {
  const decision =
    filters.decision && filters.decision !== "all" ? filters.decision : null;
  const source =
    filters.source && filters.source !== "all" ? filters.source : null;
  const linkage = filters.linkage ?? "all";
  const search = filters.search?.trim().toLowerCase() ?? "";
  const from = filters.from?.trim() || null;
  const to = filters.to?.trim() || null;
  const highScore = filters.highScore === true;

  let next = records.filter((r) => {
    if (decision && r.decision !== decision) return false;
    if (source && r.source !== source) return false;
    if (linkage === "linked" && !r.wishlistItemId) return false;
    if (linkage === "unlinked" && r.wishlistItemId) return false;
    if (highScore && (r.score == null || r.score < 70)) return false;
    if (search) {
      const hay = `${r.itemName} ${r.summary ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    const day = r.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  if (filters.sort === "high_score") {
    next = [...next].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }

  return next;
}

export function matchLookupId(
  name: string | null | undefined,
  options: { id: string; name: string }[],
): string | null {
  if (!name?.trim()) return null;
  const needle = name.trim().toLowerCase();
  const exact = options.find((o) => o.name.trim().toLowerCase() === needle);
  if (exact) return exact.id;
  const partial = options.find((o) =>
    o.name.trim().toLowerCase().includes(needle),
  );
  return partial?.id ?? null;
}
