"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  addWishlistItem,
  deleteWishlistItem,
  dismissWishlistItem,
  getShoppingDashboard,
  listWishlist,
  markPurchased,
  updateWishlistItem,
} from "@/features/shopping/services/shopping.service";
import type { SaveWishlistInput } from "@/features/shopping/types";
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

function useInvalidateShopping() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: wardrobeKeys.wishlist() });
    await queryClient.invalidateQueries({ queryKey: wardrobeKeys.shoppingDashboard() });
  };
}

export function useSaveWishlistMutation() {
  const invalidate = useInvalidateShopping();
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
  const invalidate = useInvalidateShopping();
  return useMutation({
    mutationFn: async (input: { id: string; action: "purchased" | "dismissed" | "delete" }) => {
      if (input.action === "purchased") return unwrapData(await markPurchased(input.id));
      if (input.action === "dismissed") return unwrapData(await dismissWishlistItem(input.id));
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
