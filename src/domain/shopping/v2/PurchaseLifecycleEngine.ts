/**
 * PurchaseLifecycleEngine (RFC-018B) — pure.
 * Maps subjects through wishlist → analyzed → bought → first_wear →
 * established / low_usage / retired. Extends the hub timeline idea with formal
 * learning states; does not re-score purchases.
 */

import type { BuyDecision } from "@/domain/acquisition";
import type { WishlistStatus } from "@/domain/shopping/types";
import {
  ACCEPTABLE_MAX_COST_PER_WEAR,
  ESTABLISHED_MIN_WEARS,
  LIFECYCLE_STATE_ORDER,
  LOW_USAGE_MAX_WEARS,
} from "@/domain/shopping/v2/constants";
import type {
  PurchaseLifecycle,
  PurchaseLifecycleState,
  PurchaseLifecycleSubject,
} from "@/domain/shopping/v2/types";

export interface LifecycleSubjectInput {
  id: string;
  name: string;
  category: string | null;
  status: WishlistStatus;
  latestDecision: BuyDecision | null;
  purchased: boolean;
  wears: number;
  costPerWear: number | null;
  /** Wardrobe item retired, or wishlist dismissed after purchase path. */
  retired?: boolean;
  updatedAt?: string;
}

export function resolveLifecycleState(
  input: LifecycleSubjectInput,
): PurchaseLifecycleState {
  if (input.retired) return "retired";

  const purchased = input.purchased || input.status === "purchased";
  if (purchased) {
    if (input.wears >= ESTABLISHED_MIN_WEARS) return "established";
    if (
      input.wears >= 1 &&
      input.wears <= LOW_USAGE_MAX_WEARS &&
      input.costPerWear != null &&
      input.costPerWear > ACCEPTABLE_MAX_COST_PER_WEAR
    ) {
      return "low_usage";
    }
    if (input.wears >= 1) return "first_wear";
    return "bought";
  }

  if (input.latestDecision) return "analyzed";
  return "wishlist";
}

/**
 * Path of states reached up to (and including) current. Branch states
 * (low_usage, retired) append after the linear purchase path.
 */
export function lifecycleStatesReached(
  state: PurchaseLifecycleState,
): PurchaseLifecycleState[] {
  const linear: PurchaseLifecycleState[] = [
    "wishlist",
    "analyzed",
    "bought",
    "first_wear",
    "established",
  ];

  switch (state) {
    case "wishlist":
      return ["wishlist"];
    case "analyzed":
      return ["wishlist", "analyzed"];
    case "bought":
      return ["wishlist", "analyzed", "bought"];
    case "first_wear":
      return ["wishlist", "analyzed", "bought", "first_wear"];
    case "established":
      return linear;
    case "low_usage":
      return ["wishlist", "analyzed", "bought", "first_wear", "low_usage"];
    case "retired":
      return ["wishlist", "analyzed", "bought", "retired"];
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function buildPurchaseLifecycle(
  inputs: LifecycleSubjectInput[],
): PurchaseLifecycle {
  const subjects: PurchaseLifecycleSubject[] = inputs
    .map((input) => {
      const state = resolveLifecycleState(input);
      return {
        id: input.id,
        name: input.name,
        category: input.category,
        state,
        statesReached: lifecycleStatesReached(state),
        decision: input.latestDecision,
        wears: input.wears,
        costPerWear: input.costPerWear,
      };
    })
    .sort((a, b) => {
      const ai = LIFECYCLE_STATE_ORDER.indexOf(a.state);
      const bi = LIFECYCLE_STATE_ORDER.indexOf(b.state);
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });

  return { subjects };
}
