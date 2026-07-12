/**
 * filterDecisions — pure list filtering for Decision History.
 */

import { describe, expect, it } from "vitest";

import type { BuyVsSkipAnalysis } from "@/domain/acquisition";
import { filterDecisions } from "@/features/shopping/repositories/decision.repository";
import type { AcquisitionDecisionRecord } from "@/features/shopping/types";

const stubAnalysis = {
  decision: "buy",
  score: 70,
  confidence: 0.8,
  summary: "Good fit",
} as BuyVsSkipAnalysis;

function rec(
  overrides: Partial<AcquisitionDecisionRecord> &
    Pick<
      AcquisitionDecisionRecord,
      "id" | "itemName" | "decision" | "createdAt"
    >,
): AcquisitionDecisionRecord {
  return {
    itemCategory: "blazer",
    itemSnapshot: { name: overrides.itemName, category: "blazer" },
    score: 70,
    confidence: 0.8,
    summary: "Good fit",
    analysis: stubAnalysis,
    source: "manual",
    wishlistItemId: null,
    ...overrides,
  };
}

describe("filterDecisions", () => {
  const rows = [
    rec({
      id: "1",
      itemName: "Navy Blazer",
      decision: "buy",
      createdAt: "2026-03-10T12:00:00Z",
    }),
    rec({
      id: "2",
      itemName: "Red Tie",
      decision: "skip",
      createdAt: "2026-03-05T12:00:00Z",
      summary: "Duplicate",
    }),
    rec({
      id: "3",
      itemName: "Grey Trousers",
      decision: "consider",
      createdAt: "2026-02-01T12:00:00Z",
    }),
  ];

  it("filters by decision", () => {
    expect(
      filterDecisions(rows, { decision: "skip" }).map((r) => r.id),
    ).toEqual(["2"]);
  });

  it("searches name and summary", () => {
    expect(
      filterDecisions(rows, { search: "duplicate" }).map((r) => r.id),
    ).toEqual(["2"]);
    expect(filterDecisions(rows, { search: "navy" }).map((r) => r.id)).toEqual([
      "1",
    ]);
  });

  it("filters by inclusive date range", () => {
    expect(
      filterDecisions(rows, { from: "2026-03-01", to: "2026-03-10" }).map(
        (r) => r.id,
      ),
    ).toEqual(["1", "2"]);
  });

  it("filters by source and linkage (RFC-018C)", () => {
    const withLinks = [
      rec({
        id: "1",
        itemName: "Navy Blazer",
        decision: "buy",
        createdAt: "2026-03-10T12:00:00Z",
        source: "image",
        wishlistItemId: "wl-1",
        score: 88,
      }),
      rec({
        id: "2",
        itemName: "Red Tie",
        decision: "skip",
        createdAt: "2026-03-05T12:00:00Z",
        source: "manual",
        wishlistItemId: null,
        score: 30,
      }),
    ];
    expect(
      filterDecisions(withLinks, { source: "image" }).map((r) => r.id),
    ).toEqual(["1"]);
    expect(
      filterDecisions(withLinks, { linkage: "unlinked" }).map((r) => r.id),
    ).toEqual(["2"]);
    expect(
      filterDecisions(withLinks, { highScore: true }).map((r) => r.id),
    ).toEqual(["1"]);
  });
});
