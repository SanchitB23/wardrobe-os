"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createOutfitWearLogs,
  createWearLog,
  deleteWearLog,
  fetchItemWearSummary,
  fetchOccasions,
  fetchWearLogs,
} from "@/features/wear-logs/services/wear-logs.service";
import {
  createAdHocWearLog,
  createWearLogFromOutfit,
  createWearLogFromRecommendation,
  deleteWearLogEvent,
  getDeveloperWearInsights,
  getPromotionCandidates,
  getWearLogEvent,
  listWearLogEvents,
  promoteWearLogToOutfit,
  updateWearLogEvent,
  type CreateWearLogEventInput,
  type WearEventListFilters,
} from "@/features/wear-logs/services/wear-events.service";
import { invalidateWardrobeQueries } from "@/shared/hooks/invalidate-wardrobe-queries";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";
import type {
  CreateWearLogInput,
  WearLogFilters,
  WearOutfitInput,
} from "@/types/wardrobe";

export function useOccasions() {
  return useQuery({
    queryKey: wardrobeKeys.occasions(),
    queryFn: async () => unwrapData(await fetchOccasions()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWearLogs(filters: WearLogFilters) {
  return useQuery({
    queryKey: wardrobeKeys.wearLogs(filters),
    queryFn: async () => unwrapData(await fetchWearLogs(filters)),
  });
}

export function useWearLogEvents(filters: WearEventListFilters = {}) {
  return useQuery({
    queryKey: wardrobeKeys.wearEvents(filters),
    queryFn: async () => unwrapData(await listWearLogEvents(filters)),
  });
}

export function useWearLogEvent(id: string) {
  return useQuery({
    queryKey: wardrobeKeys.wearEvent(id),
    queryFn: async () => unwrapData(await getWearLogEvent(id)),
    enabled: Boolean(id),
  });
}

export function useItemWearSummary(itemId: string) {
  return useQuery({
    queryKey: wardrobeKeys.itemWearSummary(itemId),
    queryFn: async () => unwrapData(await fetchItemWearSummary(itemId)),
    enabled: Boolean(itemId),
  });
}

export function useCreateWearLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWearLogInput) =>
      unwrapData(await createWearLog(input)),
    onSuccess: async () => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Wear logged");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log wear");
    },
  });
}

/** Ad-hoc multi-item wear log (RFC-023). */
export function useCreateAdHocWearLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<CreateWearLogEventInput, "source" | "outfitId">,
    ) => unwrapData(await createAdHocWearLog(input)),
    onSuccess: async (result) => {
      await invalidateWardrobeQueries(queryClient);
      if (result.suggestion.shouldSuggestPromote) {
        toast.success("Wear logged", {
          description: `You've worn this combination ${result.suggestion.count} times. Save as Outfit?`,
          action: {
            label: "Save as Outfit",
            onClick: () => {
              window.location.href = `/wear-logs/${result.wearLog.id}?promote=1`;
            },
          },
        });
      } else {
        toast.success("Wear logged", {
          action: {
            label: "View",
            onClick: () => {
              window.location.href = `/wear-logs/${result.wearLog.id}`;
            },
          },
        });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log wear");
    },
  });
}

export function useWearOutfitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: WearOutfitInput) => {
      const items = input.item_ids.map((itemId) => ({ itemId }));
      const event = await createWearLogFromOutfit({
        outfitId: input.outfit_id,
        items,
        wornOn: input.worn_on,
        occasionId: input.occasion_id,
        notes: input.notes,
      });
      if (event.error || !event.data) {
        return unwrapData(await createOutfitWearLogs(input));
      }
      return event.data.wearLog.items.map((i) => ({
        id: event.data!.wearLog.id,
        item_id: i.itemId,
        worn_on: event.data!.wearLog.wornOn,
        outfit_id: event.data!.wearLog.outfitId,
        occasion_id: event.data!.wearLog.occasionId,
        comfort_rating: input.comfort_rating ?? null,
        notes: event.data!.wearLog.notes,
        created_at: event.data!.wearLog.createdAt,
      }));
    },
    onSuccess: async (logs) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(
        `Logged wear for ${logs.length} item${logs.length === 1 ? "" : "s"}`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log outfit wear");
    },
  });
}

export function useWearRecommendationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      itemIds: string[];
      outfitId?: string | null;
      wornOn?: string;
      slots?: Array<{ itemId: string; slot?: string | null }>;
    }) => {
      const wornOn = input.wornOn ?? new Date().toISOString().slice(0, 10);
      const items =
        input.slots ?? input.itemIds.map((itemId) => ({ itemId }));
      return unwrapData(
        await createWearLogFromRecommendation({
          items,
          wornOn,
          outfitId: input.outfitId,
        }),
      );
    },
    onSuccess: async (result) => {
      await invalidateWardrobeQueries(queryClient);
      if (result.suggestion.shouldSuggestPromote) {
        toast.success("Logged today's wear", {
          description: `Worn ${result.suggestion.count} times — Save as Outfit?`,
          action: {
            label: "Save",
            onClick: () => {
              window.location.href = `/wear-logs/${result.wearLog.id}?promote=1`;
            },
          },
        });
      } else {
        toast.success("Logged today's wear");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log wear");
    },
  });
}

export function usePromoteWearLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      wearLogId: string;
      name: string;
      favorite?: boolean;
      tags?: string[];
      notes?: string | null;
    }) => unwrapData(await promoteWearLogToOutfit(input)),
    onSuccess: async (result) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Saved as outfit", {
        action: {
          label: "View outfit",
          onClick: () => {
            window.location.href = `/outfits/${result.outfitId}`;
          },
        },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save outfit");
    },
  });
}

export function useUpdateWearLogEventMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Parameters<typeof updateWearLogEvent>[0]) =>
      unwrapData(await updateWearLogEvent(input)),
    onSuccess: async (_data, variables) => {
      await invalidateWardrobeQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.wearEvent(variables.id),
      });
      toast.success("Wear log updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update wear log");
    },
  });
}

export function useDeleteWearLogEventMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteWearLogEvent(id);
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Wear log deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete wear log");
    },
  });
}

export function useDeleteWearLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteWearLog(id);
      if (result.error) {
        throw result.error;
      }
    },
    onSuccess: async () => {
      await invalidateWardrobeQueries(queryClient);
      toast.success("Wear log deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete wear log");
    },
  });
}

export function usePromotionCandidates() {
  return useQuery({
    queryKey: wardrobeKeys.wearPromotionCandidates(),
    queryFn: async () => unwrapData(await getPromotionCandidates()),
  });
}

export function useWearDeveloperInsights() {
  return useQuery({
    queryKey: wardrobeKeys.wearDeveloperInsights(),
    queryFn: async () => unwrapData(await getDeveloperWearInsights()),
  });
}
