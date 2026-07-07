"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  PreferenceDimension,
  PreferenceOverride,
} from "@/domain/personalization";
import {
  clearPreferenceOverride,
  getPreferenceProfile,
  savePreferenceOverride,
  setItemFlags,
  type PreferenceProfileResult,
} from "@/features/personalization/services/personalization.service";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

/** The derived preference profile (read-only query). */
export function usePreferenceProfile() {
  return useQuery<PreferenceProfileResult>({
    queryKey: wardrobeKeys.personalization(),
    queryFn: async () => unwrapData(await getPreferenceProfile()),
  });
}

/** Pin / adjust / suppress a preference; refreshes the profile on success. */
export function useSavePreferenceOverride() {
  const client = useQueryClient();
  return useMutation<true, Error, PreferenceOverride>({
    mutationFn: async (override) => unwrapData(await savePreferenceOverride(override)),
    onSuccess: () => client.invalidateQueries({ queryKey: wardrobeKeys.personalization() }),
  });
}

/** Remove a preference override. */
export function useClearPreferenceOverride() {
  const client = useQueryClient();
  return useMutation<true, Error, { dimension: PreferenceDimension; value: string }>({
    mutationFn: async ({ dimension, value }) =>
      unwrapData(await clearPreferenceOverride(dimension, value)),
    onSuccess: () => client.invalidateQueries({ queryKey: wardrobeKeys.personalization() }),
  });
}

/** Toggle an item's protected / avoided flags. */
export function useSetItemFlags() {
  const client = useQueryClient();
  return useMutation<true, Error, { itemId: string; protected?: boolean; avoided?: boolean }>({
    mutationFn: async ({ itemId, ...flags }) => unwrapData(await setItemFlags(itemId, flags)),
    onSuccess: () => client.invalidateQueries({ queryKey: wardrobeKeys.personalization() }),
  });
}
