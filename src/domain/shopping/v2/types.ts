/**
 * Acquisitions Intelligence (RFC-018B) — domain contracts.
 * Evolution over Shopping Intelligence (RFC-018): lifecycle, accuracy, need/ROI
 * timelines, opportunity queue, and dynamic strategy. Pure TypeScript.
 */

import type { BuyDecision } from "@/domain/acquisition";

export type PurchaseLifecycleState =
  | "wishlist"
  | "analyzed"
  | "bought"
  | "first_wear"
  | "established"
  | "low_usage"
  | "retired";

export interface PurchaseLifecycleSubject {
  id: string;
  name: string;
  category: string | null;
  state: PurchaseLifecycleState;
  statesReached: PurchaseLifecycleState[];
  decision: BuyDecision | null;
  wears: number;
  costPerWear: number | null;
}

export interface PurchaseLifecycle {
  subjects: PurchaseLifecycleSubject[];
}

export interface RecommendationAccuracyCase {
  decisionId: string;
  itemName: string;
  decision: BuyDecision;
  bought: boolean;
  worn: boolean;
  costPerWear: number | null;
  /** null when unscored (e.g. consider, or no terminal outcome yet). */
  correct: boolean | null;
  /** Deep correctness (buy→bought→worn→acceptable ROI); null if not in deep sample. */
  deepCorrect: boolean | null;
}

export interface RecommendationAccuracyReport {
  sampleSize: number;
  hits: number;
  accuracyPercent: number | null;
  deepSampleSize: number;
  deepHits: number;
  deepAccuracyPercent: number | null;
  cases: RecommendationAccuracyCase[];
}

export interface NeedTimelinePoint {
  date: string;
  category: string | null;
  needScore: number;
}

export interface NeedTimeline {
  points: NeedTimelinePoint[];
}

export interface RoiTimelinePoint {
  date: string;
  wardrobeRoiScore: number;
  averageCostPerWear: number | null;
}

export interface RoiCategoryCohort {
  category: string;
  score: number;
}

export interface RoiTimeline {
  points: RoiTimelinePoint[];
  bestCategories: RoiCategoryCohort[];
  worstCategories: RoiCategoryCohort[];
}

export interface OpportunityItem {
  id: string;
  name: string;
  opportunityScore: number;
  reasons: string[];
  fromPriority: number;
  lifecycleState: PurchaseLifecycleState;
  needScore: number;
  lifecycleUrgency: number;
}

export type OpportunityQueue = OpportunityItem[];

export interface ShoppingStrategyRule {
  code: string;
  message: string;
  severity: "info" | "warn";
  evidence: string[];
}

export interface DynamicShoppingStrategy {
  rules: ShoppingStrategyRule[];
  generatedAt: string;
}

export interface AcquisitionsIntelligence {
  lifecycle: PurchaseLifecycle;
  accuracy: RecommendationAccuracyReport;
  needTimeline: NeedTimeline;
  roiTimeline: RoiTimeline;
  opportunityQueue: OpportunityQueue;
  strategy: DynamicShoppingStrategy;
  metadata: { version: string; generatedAt: string };
}
