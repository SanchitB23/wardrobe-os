"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createOutfit,
  deleteOutfit,
  duplicateOutfit,
  fetchOutfitById,
  fetchOutfitLookups,
  fetchOutfitPickerItems,
  fetchOutfits,
  listOutfitsContainingItem,
  setOutfitFavorite,
  updateOutfit,
} from "@/features/outfits/services/outfits.service";
import {
  fetchOutfitEvaluation,
  fetchOutfitScores,
} from "@/features/outfits/services/outfit-evaluation.service";
import { fetchOutfitWearHistory } from "@/features/outfits/services/outfit-wear-history.service";
import type {
  OutfitDetail,
  OutfitSlot,
  SaveOutfitInput,
  UpdateOutfitInput,
} from "@/features/outfits/types";
import { invalidateWardrobeQueries } from "@/shared/hooks/invalidate-wardrobe-queries";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

export function useOutfits() {
  return useQuery({
    queryKey: wardrobeKeys.outfits(),
    queryFn: async () => unwrapData(await fetchOutfits()),
  });
}

export function useOutfit(id: string) {
  return useQuery({
    queryKey: wardrobeKeys.outfit(id),
    queryFn: async () => unwrapData(await fetchOutfitById(id)),
    enabled: Boolean(id),
  });
}

/** Saved outfits that feature the given wardrobe item (RFC-031). */
export function useOutfitsContainingItem(itemId: string) {
  return useQuery({
    queryKey: wardrobeKeys.itemOutfitsContaining(itemId),
    queryFn: async () => unwrapData(await listOutfitsContainingItem(itemId)),
    enabled: Boolean(itemId),
  });
}

export function useOutfitEvaluation(outfit: OutfitDetail | null) {
  return useQuery({
    queryKey: wardrobeKeys.outfitEvaluation(outfit?.id ?? ""),
    queryFn: async () => unwrapData(await fetchOutfitEvaluation(outfit!)),
    enabled: Boolean(outfit),
  });
}

export function useOutfitScores() {
  return useQuery({
    queryKey: wardrobeKeys.outfitScores(),
    queryFn: async () => unwrapData(await fetchOutfitScores()),
  });
}

export function useOutfitWearHistory(outfitId: string) {
  return useQuery({
    queryKey: wardrobeKeys.outfitWearHistory(outfitId),
    queryFn: async () => unwrapData(await fetchOutfitWearHistory(outfitId)),
    enabled: Boolean(outfitId),
  });
}

export function useToggleOutfitFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; favorite: boolean }) =>
      unwrapData(await setOutfitFavorite(input.id, input.favorite)),
    onSuccess: async (outfit) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(
        outfit?.favorite ? "Added to favorites" : "Removed from favorites",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update favorite");
    },
  });
}

export function useOutfitLookups() {
  return useQuery({
    queryKey: wardrobeKeys.outfitLookups(),
    queryFn: async () => unwrapData(await fetchOutfitLookups()),
  });
}

export function useOutfitPickerItems(slot: OutfitSlot, search: string) {
  return useQuery({
    queryKey: wardrobeKeys.outfitPickerItems(slot, search),
    queryFn: async () =>
      unwrapData(await fetchOutfitPickerItems(slot, search)),
    enabled: Boolean(slot),
  });
}

export function useCreateOutfitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveOutfitInput) =>
      unwrapData(await createOutfit(input)),
    onSuccess: async () => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Outfit saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save outfit");
    },
  });
}

export function useUpdateOutfitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateOutfitInput) =>
      unwrapData(await updateOutfit(input)),
    onSuccess: async () => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Outfit updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update outfit");
    },
  });
}

export function useDeleteOutfitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteOutfit(id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Outfit deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete outfit");
    },
  });
}

export function useDuplicateOutfitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrapData(await duplicateOutfit(id)),
    onSuccess: async () => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Outfit duplicated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to duplicate outfit");
    },
  });
}
