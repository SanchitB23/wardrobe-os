/**
 * AI Infrastructure Layer — public surface.
 *
 * Vendor-neutral scaffolding for multi-provider LLM use. No provider SDK, no API
 * key, no network, no React, no database yet — everything below is either a pure
 * contract, a pure helper, or a stub. See ./README.md for extension points.
 */

export * from "@/ai/types";
export * from "@/ai/providers";
export * from "@/ai/prompt-builders";
export * from "@/ai/schemas";
export * from "@/ai/cache";
export * from "@/ai/orchestrator";
