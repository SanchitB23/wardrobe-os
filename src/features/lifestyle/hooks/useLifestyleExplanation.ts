"use client";

import { useMutation } from "@tanstack/react-query";

import type { LifestylePlan } from "@/domain/lifestyle";
import {
  explainLifestylePlan,
  type LifestyleExplanationClientResult,
} from "@/features/lifestyle/services/lifestyle-explanation.client";

/**
 * Explains a Lifestyle Plan via the AI layer. A mutation (explicit "Explain"
 * action); the plan stays the source of truth — AI only narrates it.
 */
export function useLifestyleExplanation() {
  return useMutation<LifestyleExplanationClientResult, Error, LifestylePlan>({
    mutationFn: (plan) => explainLifestylePlan(plan),
  });
}
