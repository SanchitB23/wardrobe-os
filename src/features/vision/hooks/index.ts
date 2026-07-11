"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  confirmReviewItem,
  dismissReviewItem,
} from "@/domain/vision-intelligence";
import { createWearLog } from "@/features/wear-logs/services/wear-logs.service";
import { runVisionIntelligence } from "@/features/vision/services/vision.service";
import {
  clearVisionSession,
  loadVisionSession,
  saveVisionSession,
  updateVisionSessionQueue,
} from "@/features/vision/session";
import type { VisionScanMode } from "@/features/vision/types";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

const SESSION_KEY = [...wardrobeKeys.all, "vision-session"] as const;

export function useVisionSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => loadVisionSession(),
    staleTime: Infinity,
  });
}

export function useVisionScanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; mode: VisionScanMode }) =>
      unwrapData(await runVisionIntelligence(input)),
    onSuccess: (session) => {
      saveVisionSession(session);
      queryClient.setQueryData(SESSION_KEY, session);
      toast.success(
        session.mode === "closet"
          ? `Closet scan ready — ${session.queue.pendingCount} items to review`
          : `Outfit recognition ready — ${session.queue.pendingCount} actions`,
      );
    },
    onError: (error: Error) => toast.error(error.message || "Vision scan failed"),
  });
}

export function useVisionReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      action: "confirm" | "dismiss";
    }) => {
      const session = loadVisionSession();
      if (!session) throw new Error("No vision session to review.");

      const queue =
        input.action === "confirm"
          ? confirmReviewItem(session.queue, input.id)
          : dismissReviewItem(session.queue, input.id);

      const item = session.queue.items.find((i) => i.id === input.id);
      if (input.action === "confirm" && item?.kind === "log_wear" && item.matchedItemId) {
        const today = new Date().toISOString().slice(0, 10);
        unwrapData(
          await createWearLog({
            item_id: item.matchedItemId,
            worn_on: today,
          }),
        );
      }

      const next = updateVisionSessionQueue(queue);
      if (!next) throw new Error("Failed to persist review session.");
      return { session: next, item, action: input.action };
    },
    onSuccess: ({ session, item, action }) => {
      queryClient.setQueryData(SESSION_KEY, session);
      if (action === "dismiss") {
        toast.success("Dismissed");
        return;
      }
      if (item?.kind === "log_wear") {
        toast.success("Wear logged");
        void queryClient.invalidateQueries({ queryKey: wardrobeKeys.wearLogs({}) });
        return;
      }
      if (item?.kind === "add_item") {
        toast.success("Marked for add — open Inventory to create the item");
        return;
      }
      toast.success("Confirmed");
    },
    onError: (error: Error) => toast.error(error.message || "Review update failed"),
  });
}

export function useClearVisionSession() {
  const queryClient = useQueryClient();
  return () => {
    clearVisionSession();
    queryClient.setQueryData(SESSION_KEY, null);
  };
}
