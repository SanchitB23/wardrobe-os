"use client";

import { useMutation } from "@tanstack/react-query";

import {
  planTrip,
  type LifestyleResult,
  type PlanTripRequest,
} from "@/features/lifestyle/services/LifestyleService";
import { unwrapData } from "@/shared/utils/data-result";

/**
 * Generates a trip plan. A mutation (explicit "Generate Plan" action); the
 * deterministic result is held in component state.
 */
export function useLifestylePlan() {
  return useMutation<LifestyleResult, Error, PlanTripRequest>({
    mutationFn: async (request) => unwrapData(await planTrip(request)),
  });
}
