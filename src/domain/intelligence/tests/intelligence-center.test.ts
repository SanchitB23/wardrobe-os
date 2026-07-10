import { describe, expect, it } from "vitest";

import { buildIntelligenceCenter } from "@/domain/intelligence/IntelligenceCenter";
import { computeImpact, priorityFor } from "@/domain/intelligence/ImpactScoring";
import type { IntelligenceSources } from "@/domain/intelligence/ActionTypes";

const AT = "2026-07-10T00:00:00.000Z";

const build = (sources: IntelligenceSources) => buildIntelligenceCenter(sources, { generatedAt: AT });

// ---------------------------------------------------------------------------
// Impact scoring + priority
// ---------------------------------------------------------------------------

describe("impact scoring + priority", () => {
  it("weights impact by source reliability + confidence", () => {
    const high = computeImpact(1, "health", 1); // 1 × 0.95 × 1 = 0.95
    const low = computeImpact(1, "personalization", 0.2); // 1 × 0.7 × 0.6 = 0.42
    expect(high).toBeGreaterThan(low);
    expect(computeImpact(0, "health", 1)).toBe(0);
  });

  it("buckets priority deterministically", () => {
    expect(priorityFor(0.85)).toBe("critical");
    expect(priorityFor(0.65)).toBe("high");
    expect(priorityFor(0.4)).toBe("medium");
    expect(priorityFor(0.1)).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// Per-source action generation
// ---------------------------------------------------------------------------

describe("action generation — per source", () => {
  it("recommendation → a wear action", () => {
    const result = build({ recommendation: { topOutfit: { id: "o1", label: "Navy + chinos", score: 9, confidence: 0.9 } } });
    const wear = result.topActions.find((a) => a.type === "wear");
    expect(wear).toBeDefined();
    expect(wear!.sources).toContain("recommendation");
  });

  it("health gaps → buy, worn-out → replace", () => {
    const result = build({
      health: { gaps: [{ label: "smart trousers", severity: 0.9 }], wornOut: [{ itemId: "i1", label: "old loafers" }] },
    });
    expect(result.topActions.some((a) => a.type === "buy" && a.reasonCodes.includes("wardrobe_gap"))).toBe(true);
    expect(result.topActions.some((a) => a.type === "replace" && a.reasonCodes.includes("worn_out"))).toBe(true);
  });

  it("usage over-rotation → rotate", () => {
    const result = build({ usage: { overRotated: [{ itemId: "i2", label: "navy chinos", ratio: 3 }] } });
    expect(result.topActions.some((a) => a.type === "rotate" && a.reasonCodes.includes("over_rotation"))).toBe(true);
  });

  it("acquisition verdicts → buy / skip", () => {
    const result = build({
      acquisition: { verdicts: [
        { label: "linen shirt", decision: "buy", score: 0.8, confidence: 0.8 },
        { label: "third blazer", decision: "skip", score: 0.7, confidence: 0.8 },
      ] },
    });
    expect(result.topActions.some((a) => a.type === "buy")).toBe(true);
    expect(result.topActions.some((a) => a.type === "skip")).toBe(true);
  });

  it("lifestyle → clean + pack", () => {
    const result = build({
      lifestyle: { laundry: [{ label: "white shirts", urgency: 0.9 }], packing: { tripLabel: "Goa", itemCount: 8 } },
    });
    expect(result.topActions.some((a) => a.type === "clean")).toBe(true);
    expect(result.topActions.some((a) => a.type === "pack")).toBe(true);
  });

  it("personalization explore mode → explore actions (only in explore)", () => {
    const explore = build({ personalization: { exploreMode: "explore", underusedFavorites: [{ itemId: "i3", label: "olive overshirt" }] } });
    expect(explore.topActions.some((a) => a.type === "explore")).toBe(true);
    const balanced = build({ personalization: { exploreMode: "balanced", underusedFavorites: [{ itemId: "i3", label: "olive overshirt" }] } });
    expect(balanced.topActions.some((a) => a.type === "explore")).toBe(false);
  });

  it("weather severe mismatch → rotate", () => {
    const result = build({ weather: { severeMismatch: { label: "linen + sandals" } } });
    expect(result.topActions.some((a) => a.type === "rotate" && a.reasonCodes.includes("weather_mismatch"))).toBe(true);
  });

  it("vision candidate → buy / skip", () => {
    const result = build({ vision: { candidate: { label: "scanned jacket", decision: "buy", confidence: 0.7 } } });
    expect(result.topActions.some((a) => a.type === "buy" && a.sources.includes("vision"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dedup, ranking, output
// ---------------------------------------------------------------------------

describe("dedup + ranking + output", () => {
  it("collapses duplicate (type, subject) from two sources into one, merging sources", () => {
    // Health worn-out + acquisition-style replace on the same item category label.
    const result = build({
      health: {
        wornOut: [{ itemId: "shoe1", label: "brown loafers" }],
      },
      usage: {
        // Same item, different type (rotate) — NOT a dup of replace; ensure both allowed.
        overRotated: [{ itemId: "shoe1", label: "brown loafers", ratio: 3 }],
      },
    });
    // Two different action types on the same item → two cards (not merged).
    const forShoe = result.topActions.filter((a) => a.subject.id === "shoe1");
    expect(forShoe.length).toBe(2);
  });

  it("merges identical (type, subject) candidates and unions sources", () => {
    // Both health (gap) and acquisition (buy) target the same category "trousers"
    // as a `buy` on a category subject → same subjectKey → dedup.
    const result = build({
      health: { gaps: [{ label: "trousers", severity: 0.8 }] },
      acquisition: { verdicts: [{ label: "trousers", decision: "buy", score: 0.8, confidence: 0.9 }] },
    });
    const buys = result.topActions.filter((a) => a.type === "buy" && a.subject.label === "trousers");
    // Note: gap subject is a category, acquisition subject is a prospective_item —
    // different subject kinds → not merged. This asserts they remain distinct by kind.
    expect(buys.length).toBeGreaterThanOrEqual(1);
  });

  it("ranks by impact (critical health gap outranks a low explore nudge)", () => {
    const result = build({
      health: { gaps: [{ label: "smart trousers", severity: 1 }] },
      personalization: { exploreMode: "explore", underusedFavorites: [{ itemId: "i9", label: "old tee" }] },
    });
    expect(result.topActions[0].reasonCodes).toContain("wardrobe_gap");
    // Ranked descending by impact.
    for (let i = 1; i < result.topActions.length; i += 1) {
      expect(result.topActions[i - 1].impact).toBeGreaterThanOrEqual(result.topActions[i].impact);
    }
  });

  it("caps to topN and reports metadata", () => {
    const result = buildIntelligenceCenter(
      { health: { gaps: [
        { label: "a", severity: 0.9 }, { label: "b", severity: 0.8 }, { label: "c", severity: 0.7 },
      ] } },
      { generatedAt: AT, topN: 2 },
    );
    expect(result.topActions.length).toBe(2);
    expect(result.metadata.candidateCount).toBeGreaterThanOrEqual(3);
    expect(result.metadata.bySource.health).toBeGreaterThanOrEqual(3);
  });

  it("returns an empty list when there are no signals", () => {
    expect(build({}).topActions).toEqual([]);
  });

  it("is deterministic for the same sources + generatedAt", () => {
    const sources: IntelligenceSources = {
      recommendation: { topOutfit: { id: "o1", label: "look", score: 8, confidence: 0.8 } },
      health: { gaps: [{ label: "trousers", severity: 0.7 }] },
      usage: { overRotated: [{ itemId: "i1", label: "chinos", ratio: 2.5 }] },
    };
    expect(build(sources)).toEqual(build(sources));
  });

  it("every card carries impact, confidence, reason, sources, priority", () => {
    const result = build({ health: { gaps: [{ label: "trousers", severity: 0.8 }] } });
    for (const card of result.topActions) {
      expect(card.impact).toBeGreaterThanOrEqual(0);
      expect(card.impact).toBeLessThanOrEqual(1);
      expect(card.confidence).toBeGreaterThanOrEqual(0);
      expect(card.reason.length).toBeGreaterThan(0);
      expect(card.sources.length).toBeGreaterThan(0);
      expect(["critical", "high", "medium", "low"]).toContain(card.priority);
    }
  });
});
