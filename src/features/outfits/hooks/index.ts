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
  updateOutfit,
} from "@/features/outfits/services/outfits.service";
import type {
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
