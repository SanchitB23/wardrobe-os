/**
 * AcquisitionsIntelligence composer (RFC-018B) — pure.
 * Assembles lifecycle, accuracy, need/ROI evolution, opportunity, and dynamic
 * strategy from an RFC-018 dashboard + outcome inputs. No I/O, no AI.
 */

import type { ShoppingDashboard } from "@/domain/shopping/types";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import { ACQUISITIONS_INTELLIGENCE_VERSION } from "@/domain/shopping/v2/constants";
import {
  buildPurchaseLifecycle,
  type LifecycleSubjectInput,
} from "@/domain/shopping/v2/PurchaseLifecycleEngine";
import {
  buildRecommendationAccuracyReport,
  type AccuracyDecisionInput,
} from "@/domain/shopping/v2/RecommendationAccuracyEngine";
import {
  buildNeedTimeline,
  type NeedEvolutionPurchaseEvent,
} from "@/domain/shopping/v2/NeedEvolution";
import {
  buildRoiTimeline,
  type RoiEvolutionPurchase,
} from "@/domain/shopping/v2/ROIEvolution";
import { scoreOpportunities } from "@/domain/shopping/v2/OpportunityEngine";
import { buildDynamicStrategy } from "@/domain/shopping/v2/StrategyEvolution";
import type { AcquisitionsIntelligence } from "@/domain/shopping/v2/types";

export interface AcquisitionsIntelligenceInput {
  dashboard: ShoppingDashboard | null;
  lifecycleSubjects: LifecycleSubjectInput[];
  accuracyDecisions: AccuracyDecisionInput[];
  health: WardrobeHealth | null;
  needPurchases: NeedEvolutionPurchaseEvent[];
  roiPurchases: RoiEvolutionPurchase[];
  generatedAt: string;
}

/**
 * When no RFC-018 dashboard is available (empty wishlist / not loaded), still
 * produce accuracy, lifecycle, need/ROI timelines and an empty opportunity queue.
 */
export function buildAcquisitionsIntelligence(
  input: AcquisitionsIntelligenceInput,
): AcquisitionsIntelligence {
  const lifecycle = buildPurchaseLifecycle(input.lifecycleSubjects);
  const accuracy = buildRecommendationAccuracyReport(input.accuracyDecisions);
  const needTimeline = buildNeedTimeline({
    health: input.health,
    purchases: input.needPurchases,
    generatedAt: input.generatedAt,
  });
  const roiTimeline = buildRoiTimeline({
    purchases: input.roiPurchases,
    generatedAt: input.generatedAt,
  });

  const emptyDashboard: ShoppingDashboard = {
    priority: [],
    roi: {
      realized: [],
      projected: [],
      totalSpend: 0,
      averageCostPerWear: null,
      wardrobeRoiScore: 0,
    },
    duplicates: { clusters: [], wishlistDuplicateCount: 0 },
    timeline: [],
    strategy: [],
    insights: { summary: "", topReasons: [] },
    metadata: {
      engineVersion: "n/a",
      generatedAt: input.generatedAt,
      wishlistCount: 0,
    },
  };

  const opportunityQueue = scoreOpportunities({
    dashboard: input.dashboard ?? emptyDashboard,
    lifecycle,
  });

  const strategy = buildDynamicStrategy({
    accuracy,
    roiTimeline,
    needTimeline,
    opportunityQueue,
    generatedAt: input.generatedAt,
  });

  return {
    lifecycle,
    accuracy,
    needTimeline,
    roiTimeline,
    opportunityQueue,
    strategy,
    metadata: {
      version: ACQUISITIONS_INTELLIGENCE_VERSION,
      generatedAt: input.generatedAt,
    },
  };
}
