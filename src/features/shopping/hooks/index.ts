"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  addWishlistItem,
  deleteWishlistItem,
  dismissWishlistItem,
  getAcquisitionsHub,
  getShoppingDashboard,
  listWishlist,
  markPurchased,
  updateWishlistItem,
  updateWishlistPriority,
} from "@/features/shopping/services/shopping.service";
import { listDecisions } from "@/features/shopping/services/decision.service";
import type {
  DecisionListFilters,
  SaveWishlistInput,
  WishlistPriority,
} from "@/features/shopping/types";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

export function useWishlist() {
  return useQuery({
    queryKey: wardrobeKeys.wishlist(),
    queryFn: async () => unwrapData(await listWishlist()),
  });
}

export function useShoppingDashboard() {
  return useQuery({
    queryKey: wardrobeKeys.shoppingDashboard(),
    queryFn: async () => unwrapData(await getShoppingDashboard()),
  });
}

export function useAcquisitionsHub() {
  return useQuery({
    queryKey: wardrobeKeys.acquisitionsHub(),
    queryFn: async () => unwrapData(await getAcquisitionsHub()),
  });
}

export function useDecisions(filters: DecisionListFilters = {}) {
  return useQuery({
    queryKey: wardrobeKeys.acquisitionDecisions(filters),
    queryFn: async () => unwrapData(await listDecisions(filters)),
  });
}

function useInvalidateAcquisitions() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: wardrobeKeys.wishlist() });
    await queryClient.invalidateQueries({
      queryKey: wardrobeKeys.shoppingDashboard(),
    });
    await queryClient.invalidateQueries({
      queryKey: wardrobeKeys.acquisitionsHub(),
    });
    await queryClient.invalidateQueries({
      queryKey: [...wardrobeKeys.all, "acquisition-decisions"],
    });
  };
}

export function useSaveWishlistMutation() {
  const invalidate = useInvalidateAcquisitions();
  return useMutation({
    mutationFn: async (input: SaveWishlistInput) =>
      input.id
        ? unwrapData(await updateWishlistItem(input.id, input))
        : unwrapData(await addWishlistItem(input)),
    onSuccess: async () => {
      await invalidate();
      toast.success("Wishlist updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save"),
  });
}

export function useWishlistStatusMutation() {
  const invalidate = useInvalidateAcquisitions();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      action: "purchased" | "dismissed" | "delete";
    }) => {
      if (input.action === "purchased")
        return unwrapData(await markPurchased(input.id));
      if (input.action === "dismissed")
        return unwrapData(await dismissWishlistItem(input.id));
      return unwrapData(await deleteWishlistItem(input.id));
    },
    onSuccess: async (_data, input) => {
      await invalidate();
      toast.success(
        input.action === "purchased"
          ? "Marked as purchased"
          : input.action === "dismissed"
            ? "Dismissed"
            : "Removed",
      );
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update"),
  });
}

export function useWishlistPriorityMutation() {
  const invalidate = useInvalidateAcquisitions();
  return useMutation({
    mutationFn: async (input: { id: string; priority: WishlistPriority }) =>
      unwrapData(await updateWishlistPriority(input.id, input.priority)),
    onSuccess: async () => {
      await invalidate();
      toast.success("Priority updated");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update priority"),
  });
}
