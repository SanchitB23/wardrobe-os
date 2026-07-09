/**
 * Recommendation domain — the unified context every future recommendation
 * engine consumes. Public surface: the context types and the builder.
 */

export * from "@/domain/recommendation/RecommendationContext";
export * from "@/domain/recommendation/RecommendationContextBuilder";
export * from "@/domain/recommendation/OutfitRecommendationEngine";
export * from "@/domain/recommendation/UnifiedOutfitRecommendationEngine";
// RFC-012: Recommendation Engine v2 (multi-objective, weather/preference-aware,
// diverse, explainable). Supersedes the unified engine; v1 stays exported above
// as the temporary fallback contract.
export * from "@/domain/recommendation/v2";
