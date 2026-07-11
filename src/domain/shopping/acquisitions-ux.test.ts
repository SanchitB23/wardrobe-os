/**
 * Acquisitions product UX — pure helpers (recommendation accuracy + timeline).
 * Vitest; no I/O.
 */

import { describe, expect, it } from "vitest";

import {
  buildTimelineSubjects,
  resolveTimelineStage,
  sortByUserPriority,
} from "@/domain/shopping/AcquisitionTimeline";
import {
  computeRecommendationAccuracy,
  isAccuracyHit,
  outcomeByName,
} from "@/domain/shopping/recommendationAccuracy";

describe("recommendationAccuracy", () => {
  it("treats buy→purchased and skip→dismissed as hits", () => {
    expect(isAccuracyHit("buy", "purchased")).toBe(true);
    expect(isAccuracyHit("skip", "dismissed")).toBe(true);
    expect(isAccuracyHit("buy", "dismissed")).toBe(false);
    expect(isAccuracyHit("consider", "purchased")).toBe(false);
  });

  it("returns null accuracy when sample is empty", () => {
    expect(computeRecommendationAccuracy([])).toEqual({
      sampleSize: 0,
      hits: 0,
      accuracyPercent: null,
    });
    expect(
      computeRecommendationAccuracy([{ decision: "buy", outcome: "active" }]),
    ).toEqual({ sampleSize: 0, hits: 0, accuracyPercent: null });
  });

  it("computes percent from scored pairs only", () => {
    const result = computeRecommendationAccuracy([
      { decision: "buy", outcome: "purchased" },
      { decision: "skip", outcome: "dismissed" },
      { decision: "buy", outcome: "dismissed" },
      { decision: "consider", outcome: "purchased" },
      { decision: "buy", outcome: null },
    ]);
    expect(result).toEqual({ sampleSize: 3, hits: 2, accuracyPercent: 67 });
  });

  it("matches wishlist outcome by normalized name", () => {
    const wishlist = [
      { item: { name: " Navy Blazer " }, status: "purchased" as const },
    ];
    expect(outcomeByName("navy blazer", wishlist)).toBe("purchased");
    expect(outcomeByName("other", wishlist)).toBeNull();
  });
});

describe("AcquisitionTimeline", () => {
  it("resolves stages along Wishlist → Analysis → Purchase → First Wear → ROI", () => {
    expect(
      resolveTimelineStage({
        id: "1",
        name: "Jacket",
        category: "outerwear",
        status: "active",
        priority: "medium",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        latestDecision: null,
        decisionAt: null,
        purchased: false,
        purchaseDate: null,
        wears: 0,
        costPerWear: null,
      }),
    ).toBe("wishlist");

    expect(
      resolveTimelineStage({
        id: "1",
        name: "Jacket",
        category: "outerwear",
        status: "active",
        priority: "medium",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        latestDecision: "buy",
        decisionAt: "2026-01-02",
        purchased: false,
        purchaseDate: null,
        wears: 0,
        costPerWear: null,
      }),
    ).toBe("analysis");

    expect(
      resolveTimelineStage({
        id: "1",
        name: "Jacket",
        category: "outerwear",
        status: "purchased",
        priority: "high",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-03",
        latestDecision: "buy",
        decisionAt: "2026-01-02",
        purchased: true,
        purchaseDate: "2026-01-03",
        wears: 0,
        costPerWear: null,
      }),
    ).toBe("purchase");

    expect(
      resolveTimelineStage({
        id: "1",
        name: "Jacket",
        category: "outerwear",
        status: "purchased",
        priority: "high",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-04",
        latestDecision: "buy",
        decisionAt: "2026-01-02",
        purchased: true,
        purchaseDate: "2026-01-03",
        wears: 2,
        costPerWear: null,
      }),
    ).toBe("first_wear");

    expect(
      resolveTimelineStage({
        id: "1",
        name: "Jacket",
        category: "outerwear",
        status: "purchased",
        priority: "high",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-05",
        latestDecision: "buy",
        decisionAt: "2026-01-02",
        purchased: true,
        purchaseDate: "2026-01-03",
        wears: 3,
        costPerWear: 40,
      }),
    ).toBe("roi");
  });

  it("sorts by user priority then updatedAt", () => {
    const sorted = sortByUserPriority([
      { id: "a", priority: "low" as const, updatedAt: "2026-02-01" },
      { id: "b", priority: "high" as const, updatedAt: "2026-01-01" },
      { id: "c", priority: "high" as const, updatedAt: "2026-03-01" },
      { id: "d", priority: "medium" as const, updatedAt: "2026-02-15" },
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("builds timeline subjects with stagesReached", () => {
    const subjects = buildTimelineSubjects([
      {
        id: "1",
        name: "Tee",
        category: "tops",
        status: "purchased",
        priority: "medium",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-10",
        latestDecision: "buy",
        decisionAt: "2026-01-02",
        purchased: true,
        purchaseDate: "2026-01-05",
        wears: 1,
        costPerWear: 20,
      },
    ]);
    expect(subjects[0]?.stage).toBe("roi");
    expect(subjects[0]?.stagesReached).toEqual([
      "wishlist",
      "analysis",
      "purchase",
      "first_wear",
      "roi",
    ]);
  });
});
