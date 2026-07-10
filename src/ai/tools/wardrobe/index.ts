/**
 * Wardrobe tools — the concrete capabilities the model may call.
 *
 * Layering (enforced here): the AI never touches the database. It emits a tool
 * call → the executor runs one of these tools → the tool calls a feature
 * SERVICE → the service calls a repository → the repository calls Supabase.
 * These are the only files in `src/ai` that import feature services, and they
 * run server-side (the app is anon-key + RLS, so reads work without a session).
 *
 * Every service is injectable (defaults to the real one) so tools are unit
 * tested without a network. Results are trimmed to the fields a model needs.
 */

import { objectParams, type JSONSchema } from "@/ai/tools/json-schema";
import { ToolRegistry } from "@/ai/tools/tool-registry";
import type { AITool } from "@/ai/tools/types";
import { fetchWardrobeItemDetail } from "@/features/inventory/services/item-detail.service";
import { fetchWardrobeItems } from "@/features/inventory/services/inventory.service";
import {
  fetchInsightReport,
  fetchUsageAnalytics,
  fetchWardrobeHealth,
} from "@/features/analytics/services/analytics.service";
import { fetchOutfitById } from "@/features/outfits/services/outfits.service";
import { fetchPurchaseAnalytics } from "@/features/purchases/services/purchases.service";
import {
  fetchOutfitRecommendations,
  type RecommendationFilters,
} from "@/features/recommendations/services/recommendations.service";
import { runOrchestration } from "@/features/orchestrator/services/orchestrator.service";
import { getIntelligenceCenter } from "@/features/intelligence/services/intelligence-center.service";
import type { CapabilityId } from "@/domain/orchestrator";
import type { InventoryFilters } from "@/types/wardrobe";

type Result<T> = { data: T | null; error: Error | null };

/** Unwrap a service result; throw on error/absent so the executor reports it. */
function required<T>(result: Result<T>): T {
  if (result.error) throw result.error;
  if (result.data == null) throw new Error("No data returned.");
  return result.data;
}

export interface WardrobeToolDeps {
  fetchOutfitRecommendations: typeof fetchOutfitRecommendations;
  fetchWardrobeHealth: typeof fetchWardrobeHealth;
  fetchUsageAnalytics: typeof fetchUsageAnalytics;
  fetchInsightReport: typeof fetchInsightReport;
  fetchOutfitById: typeof fetchOutfitById;
  fetchWardrobeItemDetail: typeof fetchWardrobeItemDetail;
  fetchWardrobeItems: typeof fetchWardrobeItems;
  fetchPurchaseAnalytics: typeof fetchPurchaseAnalytics;
  runOrchestration: typeof runOrchestration;
  getIntelligenceCenter: typeof getIntelligenceCenter;
}

const DEFAULT_DEPS: WardrobeToolDeps = {
  fetchOutfitRecommendations,
  fetchWardrobeHealth,
  fetchUsageAnalytics,
  fetchInsightReport,
  fetchOutfitById,
  fetchWardrobeItemDetail,
  fetchWardrobeItems,
  fetchPurchaseAnalytics,
  runOrchestration,
  getIntelligenceCenter,
};

const SEASON: JSONSchema = {
  type: "string",
  enum: ["summer", "monsoon", "autumn", "winter", "spring"],
};
const WEATHER: JSONSchema = {
  type: "string",
  enum: ["hot", "warm", "mild", "cool", "cold", "rainy"],
};
const COMMUTE: JSONSchema = {
  type: "string",
  enum: ["wfh", "metro", "car", "walk", "mixed"],
};

// ---------------------------------------------------------------------------
// Tool factories.
// ---------------------------------------------------------------------------

function getRecommendationsTool(deps: WardrobeToolDeps): AITool {
  return {
    name: "getRecommendations",
    description:
      "Get ranked outfit recommendations (saved + generated) for optional context filters. Returns already-scored outfits; does not decide anything new.",
    parameters: objectParams({
      occasion: { type: "string", description: "e.g. Office, Casual, Dinner, Travel" },
      season: SEASON,
      weather: WEATHER,
      commute: COMMUTE,
      favoritesOnly: { type: "boolean" },
      limit: { type: "integer", description: "max recommendations to return (default 5)" },
    }),
    async execute(args) {
      const filters: RecommendationFilters = {
        occasion: (args.occasion as string) ?? null,
        season: (args.season as RecommendationFilters["season"]) ?? null,
        weather: (args.weather as RecommendationFilters["weather"]) ?? null,
        commute: (args.commute as RecommendationFilters["commute"]) ?? null,
        favoritesOnly: Boolean(args.favoritesOnly),
      };
      const data = required(await deps.fetchOutfitRecommendations(filters));
      const limit = typeof args.limit === "number" ? args.limit : 5;
      return {
        count: data.recommendations.length,
        // RFC-012: surface the v2 reason codes so the stylist can explain the
        // deterministic ranking (it never re-ranks).
        recommendations: data.recommendations.slice(0, limit).map((rec) => ({
          id: rec.id,
          name: rec.name,
          source: rec.source,
          score: rec.score,
          confidence: rec.confidence,
          reason: rec.reason,
          reasonCodes: rec.reasonCodes,
          items: rec.items.map((item) => ({
            slot: item.slot,
            name: item.name,
            category: item.category,
          })),
        })),
      };
    },
  };
}

function getWardrobeHealthTool(deps: WardrobeToolDeps): AITool {
  return {
    name: "getWardrobeHealth",
    description:
      "Get the wardrobe health report: overall score, category/occasion/season scores, strengths, weaknesses, gaps, and duplicates.",
    parameters: objectParams({}),
    async execute() {
      return required(await deps.fetchWardrobeHealth()).health;
    },
  };
}

function getUsageAnalyticsTool(deps: WardrobeToolDeps): AITool {
  return {
    name: "getUsageAnalytics",
    description:
      "Get wear/usage analytics: total wears, most/least worn, never-worn and stale items, and usage insights.",
    parameters: objectParams({}),
    async execute() {
      return required(await deps.fetchUsageAnalytics());
    },
  };
}

function getInsightsTool(deps: WardrobeToolDeps): AITool {
  return {
    name: "getInsights",
    description:
      "Get the wardrobe insight report: overall summary plus prioritised insights, top actions, warnings, and strengths.",
    parameters: objectParams({}),
    async execute() {
      return required(await deps.fetchInsightReport());
    },
  };
}

function getOutfitTool(deps: WardrobeToolDeps): AITool {
  return {
    name: "getOutfit",
    description: "Get a single saved outfit by id.",
    parameters: objectParams(
      { outfitId: { type: "string", description: "the outfit's id" } },
      { required: ["outfitId"] },
    ),
    async execute(args) {
      const result = await deps.fetchOutfitById(args.outfitId as string);
      if (result.error) throw result.error;
      if (!result.data) return { found: false };
      return { found: true, outfit: result.data };
    },
  };
}

function getItemTool(deps: WardrobeToolDeps): AITool {
  return {
    name: "getItem",
    description: "Get a single wardrobe item's detail by id.",
    parameters: objectParams(
      { itemId: { type: "string", description: "the item's id" } },
      { required: ["itemId"] },
    ),
    async execute(args) {
      const result = await deps.fetchWardrobeItemDetail(args.itemId as string);
      if (result.error) throw result.error;
      if (!result.data) return { found: false };
      return { found: true, item: result.data };
    },
  };
}

interface ItemRowLike {
  id: string;
  name: string;
  formality: string | null;
  rating: number | null;
  status: string | null;
  favorite?: boolean | null;
}

function searchInventoryTool(deps: WardrobeToolDeps): AITool {
  return {
    name: "searchInventory",
    description:
      "Search the wardrobe by text and simple filters. Returns a trimmed list of matching items.",
    parameters: objectParams({
      query: { type: "string", description: "free-text search over item names" },
      formality: { type: "string", description: "e.g. casual, smart_casual, formal" },
      status: { type: "string", description: "e.g. active, retired" },
      favorite: { type: "boolean", description: "only favourited items" },
      limit: { type: "integer", description: "max items to return (default 20)" },
    }),
    async execute(args) {
      const filters: InventoryFilters = {
        search: (args.query as string) || undefined,
        formality: args.formality as InventoryFilters["formality"],
        status: args.status as InventoryFilters["status"],
      };
      const rows = required(await deps.fetchWardrobeItems(filters)) as ItemRowLike[];
      const filtered = args.favorite ? rows.filter((row) => row.favorite) : rows;
      const limit = typeof args.limit === "number" ? args.limit : 20;
      return {
        count: filtered.length,
        items: filtered.slice(0, limit).map((row) => ({
          id: row.id,
          name: row.name,
          formality: row.formality,
          rating: row.rating,
          status: row.status,
          favorite: Boolean(row.favorite),
        })),
      };
    },
  };
}

function getShoppingAdviceTool(deps: WardrobeToolDeps): AITool {
  return {
    name: "getShoppingAdvice",
    description:
      "Get what to buy next: wardrobe gaps and recommendations derived from the health report, with spending context from purchase analytics. Composes existing analyses; invents nothing.",
    parameters: objectParams({
      budget: { type: "number", description: "optional monthly budget for context" },
    }),
    async execute(args) {
      const health = required(await deps.fetchWardrobeHealth()).health;
      const purchaseResult = await deps.fetchPurchaseAnalytics();
      const purchase = purchaseResult.error ? null : purchaseResult.data;
      return {
        overallScore: health.overallScore,
        gaps: health.gaps,
        recommendations: health.recommendations,
        weaknesses: health.weaknesses,
        budget: typeof args.budget === "number" ? args.budget : null,
        spendingContext: purchase
          ? {
              totalWardrobeValue: purchase.totalWardrobeValue,
              averageCostPerWear: purchase.averageCostPerWear,
            }
          : null,
      };
    },
  };
}

/**
 * Build a registry with all eight Wardrobe tools. Pass `deps` to inject fake
 * services in tests; defaults to the real feature services.
 */
const CAPABILITY: JSONSchema = {
  type: "string",
  enum: [
    "health",
    "usage",
    "analytics",
    "outfit",
    "recommendation",
    "personalization",
    "vision",
    "acquisition",
  ],
};

/**
 * RFC-005: rather than calling a single service, the model can ask the
 * Intelligence Orchestrator to run a set of capabilities. The Orchestrator
 * decides execution order (dependency resolution) and runs the deterministic
 * engines; this tool returns the execution report. The model requests; it never
 * plans or executes — and it never decides (ADR-005).
 */
function runIntelligenceTool(deps: WardrobeToolDeps): AITool {
  return {
    name: "runIntelligence",
    description:
      "Run one or more wardrobe intelligence capabilities through the Intelligence Orchestrator, which resolves dependencies and executes the deterministic engines in order. Returns an execution report (what ran, order, confidence, failures). Use for multi-capability requests instead of calling engines individually.",
    parameters: objectParams({
      capabilities: {
        type: "array",
        items: CAPABILITY,
        description: "Capabilities to run, e.g. ['recommendation'] or ['analytics'].",
      },
      occasion: { type: "string", description: "Optional occasion context, e.g. Office, Travel." },
      limit: { type: "integer", description: "Max results for list-producing capabilities." },
    }),
    async execute(args) {
      const capabilities = Array.isArray(args.capabilities)
        ? (args.capabilities as CapabilityId[])
        : [];
      if (capabilities.length === 0) {
        throw new Error("runIntelligence requires at least one capability.");
      }
      const report = required(
        await deps.runOrchestration({
          capabilities,
          inputs: {
            occasion: typeof args.occasion === "string" ? args.occasion : null,
            limit: typeof args.limit === "number" ? args.limit : undefined,
          },
        }),
      );
      // Trim to a model-friendly summary (omit large raw engine outputs).
      return {
        executed: report.executedCapabilities,
        skipped: report.skippedCapabilities,
        failed: report.failedCapabilities,
        executionOrder: report.executionOrder,
        confidence: report.confidence,
        explainability: report.explainability,
        outcomes: Object.fromEntries(
          Object.values(report.outcomes).map((o) => [
            o.id,
            { status: o.status, confidence: o.confidence, error: o.error },
          ]),
        ),
      };
    },
  };
}

/**
 * getTopActions (RFC-015) — the Intelligence Center's prioritised, deduped,
 * impact-ranked action list aggregated across every deterministic engine.
 * Returns already-decided actions; the model explains them, never re-ranks.
 */
function getTopActionsTool(deps: WardrobeToolDeps): AITool {
  return {
    name: "getTopActions",
    description:
      "Get the Intelligence Center's prioritised list of what to do next — typed actions (wear/buy/skip/clean/rotate/pack/replace/explore) aggregated and impact-ranked across every deterministic engine. Returns already-decided actions; does not decide anything new.",
    parameters: objectParams({
      limit: { type: "integer", description: "max actions to return (default 7)" },
    }),
    async execute(args) {
      const limit = typeof args.limit === "number" ? args.limit : 7;
      const data = required(await deps.getIntelligenceCenter({ topN: limit }));
      return {
        count: data.topActions.length,
        actions: data.topActions.map((a) => ({
          type: a.type,
          subject: a.subject.label,
          priority: a.priority,
          impact: a.impact,
          confidence: a.confidence,
          reason: a.reason,
          sources: a.sources,
        })),
      };
    },
  };
}

export function createWardrobeToolRegistry(
  deps: Partial<WardrobeToolDeps> = {},
): ToolRegistry {
  const resolved: WardrobeToolDeps = { ...DEFAULT_DEPS, ...deps };
  return new ToolRegistry([
    getRecommendationsTool(resolved),
    getWardrobeHealthTool(resolved),
    getUsageAnalyticsTool(resolved),
    getInsightsTool(resolved),
    getOutfitTool(resolved),
    getItemTool(resolved),
    searchInventoryTool(resolved),
    getShoppingAdviceTool(resolved),
    getTopActionsTool(resolved),
    runIntelligenceTool(resolved),
  ]);
}
