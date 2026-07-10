/**
 * Intelligence Center (RFC-015) — Action Generator.
 *
 * One pure mapper per source engine, each turning that engine's normalized
 * output into candidate actions with a provisional impact read from the engine's
 * own signal. It invents no verdict — it re-expresses existing engine conclusions
 * as typed actions. Deterministic; no I/O.
 */

import type {
  AcquisitionSourceInput,
  ActionCandidate,
  HealthSourceInput,
  IntelligenceSources,
  LifestyleSourceInput,
  PersonalizationSourceInput,
  RecommendationSourceInput,
  UsageSourceInput,
  VisionSourceInput,
  WeatherSourceInput,
} from "@/domain/intelligence/ActionTypes";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Keep each source from flooding the list; ranking picks the strongest overall. */
const PER_SOURCE_CAP = 3;

export function fromRecommendation(input: RecommendationSourceInput | undefined): ActionCandidate[] {
  if (!input?.topOutfit) return [];
  const { id, label, score, confidence } = input.topOutfit;
  return [
    {
      type: "wear",
      subject: { kind: "outfit", id, label },
      source: "recommendation",
      provisionalImpact: clamp01(score / 10),
      confidence: clamp01(confidence),
      reason: `Today's top outfit: ${label}.`,
      reasonCodes: ["top_recommendation"],
      href: "/recommendations",
    },
  ];
}

export function fromHealth(input: HealthSourceInput | undefined): ActionCandidate[] {
  if (!input) return [];
  const out: ActionCandidate[] = [];
  for (const gap of (input.gaps ?? []).slice(0, PER_SOURCE_CAP)) {
    out.push({
      type: "buy",
      subject: { kind: "category", label: gap.label },
      source: "health",
      provisionalImpact: clamp01(gap.severity),
      confidence: 0.8,
      reason: `Coverage gap: ${gap.label}.`,
      reasonCodes: ["wardrobe_gap"],
      href: "/acquisition/advisor",
    });
  }
  for (const worn of (input.wornOut ?? []).slice(0, PER_SOURCE_CAP)) {
    out.push({
      type: "replace",
      subject: { kind: "item", id: worn.itemId, label: worn.label },
      source: "health",
      provisionalImpact: 0.7,
      confidence: 0.75,
      reason: `${worn.label} is worn out — consider replacing it.`,
      reasonCodes: ["worn_out"],
    });
  }
  for (const dup of (input.duplicates ?? []).slice(0, PER_SOURCE_CAP)) {
    out.push({
      type: "replace",
      subject: { kind: "category", label: dup.label },
      source: "health",
      provisionalImpact: clamp01(dup.count / 5),
      confidence: 0.6,
      reason: `Several near-duplicate ${dup.label} — rotate or consolidate.`,
      reasonCodes: ["duplicate"],
    });
  }
  return out;
}

export function fromUsage(input: UsageSourceInput | undefined): ActionCandidate[] {
  if (!input) return [];
  const out: ActionCandidate[] = [];
  for (const over of (input.overRotated ?? []).slice(0, PER_SOURCE_CAP)) {
    out.push({
      type: "rotate",
      subject: { kind: "item", id: over.itemId, label: over.label },
      source: "usage",
      provisionalImpact: clamp01((over.ratio - 1) / 2),
      confidence: 0.8,
      reason: `${over.label} is over-worn — give something else a turn.`,
      reasonCodes: ["over_rotation"],
    });
  }
  for (const under of (input.underUsed ?? []).slice(0, PER_SOURCE_CAP)) {
    out.push({
      type: "rotate",
      subject: { kind: "item", id: under.itemId, label: under.label },
      source: "usage",
      provisionalImpact: under.stale ? 0.5 : 0.35,
      confidence: 0.7,
      reason: `${under.label} is ${under.stale ? "gathering dust" : "rarely worn"} — work it back in.`,
      reasonCodes: [under.stale ? "stale_item" : "under_rotation"],
    });
  }
  return out;
}

export function fromAcquisition(input: AcquisitionSourceInput | undefined): ActionCandidate[] {
  if (!input?.verdicts) return [];
  return input.verdicts.slice(0, PER_SOURCE_CAP).map((v) => ({
    type: v.decision,
    subject: { kind: "prospective_item" as const, label: v.label },
    source: "acquisition" as const,
    provisionalImpact: clamp01(v.score),
    confidence: clamp01(v.confidence),
    reason: v.decision === "buy" ? `Worth buying: ${v.label}.` : `Better to skip: ${v.label}.`,
    reasonCodes: [v.decision === "buy" ? "buy_verdict" : "skip_verdict"],
    href: "/acquisition/advisor",
  }));
}

export function fromPersonalization(input: PersonalizationSourceInput | undefined): ActionCandidate[] {
  if (!input || input.exploreMode !== "explore") return [];
  return (input.underusedFavorites ?? []).slice(0, PER_SOURCE_CAP).map((item) => ({
    type: "explore" as const,
    subject: { kind: "item" as const, id: item.itemId, label: item.label },
    source: "personalization" as const,
    provisionalImpact: 0.45,
    confidence: 0.65,
    reason: `Explore mode: rediscover ${item.label}.`,
    reasonCodes: ["explore_underused"],
    href: "/recommendations",
  }));
}

export function fromLifestyle(input: LifestyleSourceInput | undefined): ActionCandidate[] {
  if (!input) return [];
  const out: ActionCandidate[] = [];
  for (const wash of (input.laundry ?? []).slice(0, PER_SOURCE_CAP)) {
    out.push({
      type: "clean",
      subject: { kind: "item", label: wash.label },
      source: "lifestyle",
      provisionalImpact: clamp01(wash.urgency),
      confidence: 0.8,
      reason: `Clean ${wash.label} before you need it.`,
      reasonCodes: ["laundry_due"],
      href: "/trips",
    });
  }
  if (input.packing) {
    out.push({
      type: "pack",
      subject: { kind: "trip", label: input.packing.tripLabel },
      source: "lifestyle",
      provisionalImpact: 0.7,
      confidence: 0.85,
      reason: `Pack ${input.packing.itemCount} pieces for ${input.packing.tripLabel}.`,
      reasonCodes: ["trip_packing"],
      href: "/trips",
    });
  }
  return out;
}

export function fromWeather(input: WeatherSourceInput | undefined): ActionCandidate[] {
  if (!input?.severeMismatch) return [];
  return [
    {
      type: "rotate",
      subject: { kind: "outfit", label: input.severeMismatch.label },
      source: "weather",
      provisionalImpact: 0.75,
      confidence: 0.7,
      reason: `Today's weather doesn't suit ${input.severeMismatch.label} — swap to something appropriate.`,
      reasonCodes: ["weather_mismatch"],
      href: "/recommendations",
    },
  ];
}

export function fromVision(input: VisionSourceInput | undefined): ActionCandidate[] {
  if (!input?.candidate) return [];
  const c = input.candidate;
  return [
    {
      type: c.decision,
      subject: { kind: "prospective_item", label: c.label },
      source: "vision",
      provisionalImpact: c.decision === "buy" ? 0.6 : 0.5,
      confidence: clamp01(c.confidence),
      reason: c.decision === "buy" ? `Scanned item worth buying: ${c.label}.` : `Scanned item to skip: ${c.label}.`,
      reasonCodes: [c.decision === "buy" ? "buy_verdict" : "skip_verdict"],
      href: "/acquisition/screenshot",
    },
  ];
}

/** All candidate actions across every source. Deterministic order (by source). */
export function generateActions(sources: IntelligenceSources): ActionCandidate[] {
  return [
    ...fromRecommendation(sources.recommendation),
    ...fromHealth(sources.health),
    ...fromUsage(sources.usage),
    ...fromAcquisition(sources.acquisition),
    ...fromPersonalization(sources.personalization),
    ...fromLifestyle(sources.lifestyle),
    ...fromWeather(sources.weather),
    ...fromVision(sources.vision),
  ];
}
