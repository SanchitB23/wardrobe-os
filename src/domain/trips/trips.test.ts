import { describe, expect, it } from "vitest";

import type { DailyOutfit, TripDay } from "@/domain/lifestyle";
import {
  addDays,
  buildPackingChecklist,
  buildTimeline,
  cityForDate,
  cloneTripSpec,
  daysBetween,
  durationDays,
  expandTemplate,
  type TripSpec,
} from "@/domain/trips";

const baseSpec: TripSpec = {
  name: "Goa long weekend",
  destination: "Goa",
  startDate: "2026-08-01",
  endDate: "2026-08-04",
  cities: [
    { city: "Delhi", startDate: "2026-08-01", endDate: "2026-08-02", sortOrder: 0 },
    { city: "Goa", startDate: "2026-08-03", endDate: "2026-08-04", sortOrder: 1 },
  ],
  events: [{ date: "2026-08-02", occasion: "Wedding", formalityHint: "formal" }],
  travelStyle: "standard",
  planningStrategy: "balanced",
  laundry: { available: false },
  luggage: { kind: "carry_on", maxItems: 10 },
  notes: "Bring the linen shirt",
};

describe("date helpers", () => {
  it("adds days across month boundaries (UTC)", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("computes signed daysBetween and inclusive durationDays", () => {
    expect(daysBetween("2026-08-01", "2026-08-04")).toBe(3);
    expect(daysBetween("2026-08-04", "2026-08-01")).toBe(-3);
    expect(durationDays("2026-08-01", "2026-08-04")).toBe(4);
    expect(durationDays("2026-08-01", "2026-08-01")).toBe(1);
    expect(durationDays("2026-08-04", "2026-08-01")).toBe(0); // invalid range
  });
});

describe("expandTemplate", () => {
  it("expands business_3day into a 3-day, business-strategy draft with events", () => {
    const spec = expandTemplate("business_3day", { startDate: "2026-09-10", destination: "Berlin" });
    expect(spec).not.toBeNull();
    expect(spec!.startDate).toBe("2026-09-10");
    expect(spec!.endDate).toBe("2026-09-12"); // inclusive 3 days
    expect(spec!.planningStrategy).toBe("business");
    expect(spec!.laundry.available).toBe(true);
    expect(spec!.destination).toBe("Berlin");
    expect(spec!.events).toEqual([
      { date: "2026-09-10", occasion: "Meetings", formalityHint: "business formal" },
      { date: "2026-09-11", occasion: "Meetings", formalityHint: "business formal" },
    ]);
  });

  it("returns null for an unknown template", () => {
    expect(expandTemplate("nope", { startDate: "2026-09-10" })).toBeNull();
  });
});

describe("cloneTripSpec", () => {
  it("shifts every date by the same delta, preserving duration and offsets", () => {
    const clone = cloneTripSpec(baseSpec, "2026-09-01"); // +31 days
    expect(clone.startDate).toBe("2026-09-01");
    expect(clone.endDate).toBe("2026-09-04");
    expect(clone.name).toBe("Goa long weekend (copy)");
    expect(clone.cities.map((c) => [c.startDate, c.endDate])).toEqual([
      ["2026-09-01", "2026-09-02"],
      ["2026-09-03", "2026-09-04"],
    ]);
    expect(clone.events[0].date).toBe("2026-09-02");
    // Original is untouched (pure).
    expect(baseSpec.startDate).toBe("2026-08-01");
  });
});

describe("cityForDate", () => {
  it("resolves the leg covering a date, else null", () => {
    expect(cityForDate(baseSpec.cities, "2026-08-01")).toBe("Delhi");
    expect(cityForDate(baseSpec.cities, "2026-08-03")).toBe("Goa");
    expect(cityForDate(baseSpec.cities, "2026-08-09")).toBeNull();
    expect(cityForDate([], "2026-08-01")).toBeNull(); // single-destination
  });
});

describe("buildPackingChecklist", () => {
  it("merges packed state and counts total/packed across slots", () => {
    const bySlot = { top: ["a", "b"], bottom: ["c"] };
    const checklist = buildPackingChecklist(bySlot, ["a", "c"], (id) => `Item ${id}`);
    expect(checklist.total).toBe(3);
    expect(checklist.packed).toBe(2);
    expect(checklist.bySlot.top).toEqual([
      { itemId: "a", label: "Item a", packed: true },
      { itemId: "b", label: "Item b", packed: false },
    ]);
    expect(checklist.bySlot.bottom[0].packed).toBe(true);
  });

  it("packed ids not in the plan do not inflate the count", () => {
    const checklist = buildPackingChecklist({ top: ["a"] }, ["a", "ghost"], (id) => id);
    expect(checklist.total).toBe(1);
    expect(checklist.packed).toBe(1);
  });
});

describe("buildTimeline", () => {
  const days: TripDay[] = [
    { date: "2026-08-01", occasion: "Casual", weather: { date: "2026-08-01", season: "summer", condition: "warm", highC: 30, lowC: 22, rainRisk: 0.1 } },
    { date: "2026-08-02", occasion: "Wedding", weather: { date: "2026-08-02", season: "summer", condition: "hot", highC: 34, lowC: 24, rainRisk: 0 } },
  ];
  const dailyOutfits: DailyOutfit[] = [
    { date: "2026-08-01", occasion: "Casual", weather: { condition: "warm", season: "summer" }, itemIds: ["x", "y"], score: 8.2, reason: "ok", uncovered: false },
  ];

  it("maps days to timeline entries, joining outfits and tagging city; uncovered when no outfit", () => {
    const timeline = buildTimeline(days, dailyOutfits, baseSpec.cities);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({
      date: "2026-08-01",
      city: "Delhi",
      occasion: "Casual",
      outfitItemIds: ["x", "y"],
      uncovered: false,
    });
    expect(timeline[0].weather).toEqual({ condition: "warm", season: "summer" });
    // No outfit for day 2 → uncovered, empty items.
    expect(timeline[1]).toMatchObject({ date: "2026-08-02", city: "Delhi", outfitItemIds: [], uncovered: true, score: 0 });
  });
});
