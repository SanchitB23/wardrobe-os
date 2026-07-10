"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  cloneTrip,
  createTrip,
  createTripFromTemplate,
  deleteTrip,
  getTrip,
  getTripPlan,
  listTrips,
  setPackingProgress,
  updateTrip,
} from "@/features/trips/services/trips.service";
import type { SaveTripInput } from "@/features/trips/types";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

export function useTrips() {
  return useQuery({
    queryKey: wardrobeKeys.trips(),
    queryFn: async () => unwrapData(await listTrips()),
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: wardrobeKeys.trip(id),
    queryFn: async () => unwrapData(await getTrip(id)),
    enabled: Boolean(id),
  });
}

export function useTripPlan(id: string) {
  return useQuery({
    queryKey: wardrobeKeys.tripPlan(id),
    queryFn: async () => unwrapData(await getTripPlan(id)),
    enabled: Boolean(id),
  });
}

async function invalidateTrips(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: wardrobeKeys.trips() });
}

export function useSaveTripMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveTripInput) =>
      input.id
        ? unwrapData(await updateTrip(input.id, input))
        : unwrapData(await createTrip(input)),
    onSuccess: async (trip) => {
      await invalidateTrips(queryClient);
      await queryClient.invalidateQueries({ queryKey: wardrobeKeys.trip(trip.id) });
      await queryClient.invalidateQueries({ queryKey: wardrobeKeys.tripPlan(trip.id) });
      toast.success("Trip saved");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save trip"),
  });
}

export function useCreateFromTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { templateId: string; startDate: string; destination?: string | null }) =>
      unwrapData(await createTripFromTemplate(input.templateId, input)),
    onSuccess: async () => {
      await invalidateTrips(queryClient);
      toast.success("Trip created from template");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create trip"),
  });
}

export function useCloneTripMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; newStartDate: string }) =>
      unwrapData(await cloneTrip(input.id, input.newStartDate)),
    onSuccess: async () => {
      await invalidateTrips(queryClient);
      toast.success("Trip cloned");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to clone trip"),
  });
}

export function useDeleteTripMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrapData(await deleteTrip(id)),
    onSuccess: async () => {
      await invalidateTrips(queryClient);
      toast.success("Trip deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete trip"),
  });
}

export function useSetPackingProgressMutation(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; packed: boolean }) =>
      unwrapData(await setPackingProgress(tripId, input.itemId, input.packed)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wardrobeKeys.tripPlan(tripId) });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update packing"),
  });
}
