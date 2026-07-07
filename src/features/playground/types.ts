/**
 * Shared request/result types for the AI Playground. Plain data so both the
 * client form and the server handler speak the same shape.
 */

import type { AIProviderId, ValidationResult } from "@/ai/types";

export interface PlaygroundRunRequest {
  builderId: string;
  provider?: AIProviderId;
  model?: string;
  /** Structured input payload (already parsed from the editor). */
  input: unknown;
  /** Cache is OFF by default in the playground; opt in explicitly. */
  cacheEnabled?: boolean;
  forceRefresh?: boolean;
}

export interface PlaygroundRunResult {
  builderId: string;
  provider?: AIProviderId;
  model?: string;
  /** The prompt the builder produced. */
  systemPrompt?: string;
  userPrompt: string;
  /** The structured input payload echoed back. */
  input: unknown;
  /** Raw model text (present when the call succeeded). */
  responseText?: string;
  /** Parsed structured output (present when validation passed). */
  responseJson?: unknown;
  /** Schema validation outcome for the raw response. */
  validation?: ValidationResult;
  latencyMs?: number;
  /** True = served from cache, false = fresh, undefined = caching off. */
  cached?: boolean;
  /** Populated when the provider call failed; the prompt/input still return. */
  error?: string;
}
