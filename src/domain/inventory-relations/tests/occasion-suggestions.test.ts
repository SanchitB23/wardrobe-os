import { describe, expect, it } from "vitest";

import {
  matchOccasionsToConcepts,
  suggestOccasionConcepts,
} from "@/domain/inventory-relations";

// Mirrors the live lookup (personal taxonomy — RFC-026 design decision 2).
const LOOKUP = [
  { id: "o1", name: "Office Daily" },
  { id: "o2", name: "Office Leadership" },
  { id: "o3", name: "WFH" },
  { id: "o4", name: "Home" },
  { id: "o5", name: "Gym" },
  { id: "o6", name: "Travel" },
  { id: "o7", name: "Airport" },
  { id: "o8", name: "Vacation" },
  { id: "o9", name: "Wedding" },
  { id: "o10", name: "Reception" },
  { id: "o11", name: "Brewery" },
  { id: "o12", name: "Client Meeting" },
];

describe("suggestOccasionConcepts", () => {
  it("maps business_casual formality to office", () => {
    const concepts = suggestOccasionConcepts({
      formality: "business_casual",
      tags: [],
      styles: [],
      categoryName: null,
    });
    expect(concepts.map((c) => c.concept)).toContain("office");
    expect(concepts.find((c) => c.concept === "office")?.reason).toBe(
      "formality:business_casual",
    );
  });

  it("maps formal formality to office and wedding", () => {
    const concepts = suggestOccasionConcepts({
      formality: "formal",
      tags: [],
      styles: [],
      categoryName: null,
    }).map((c) => c.concept);
    expect(concepts).toContain("office");
    expect(concepts).toContain("wedding");
  });

  it("maps casual formality to home", () => {
    const concepts = suggestOccasionConcepts({
      formality: "casual",
      tags: [],
      styles: [],
      categoryName: null,
    }).map((c) => c.concept);
    expect(concepts).toContain("home");
  });

  it("maps gym/athleisure tags and styles to gym", () => {
    const fromTag = suggestOccasionConcepts({
      formality: null,
      tags: ["gym wear"],
      styles: [],
      categoryName: null,
    });
    const fromStyle = suggestOccasionConcepts({
      formality: null,
      tags: [],
      styles: ["Athleisure"],
      categoryName: null,
    });
    expect(fromTag.map((c) => c.concept)).toContain("gym");
    expect(fromTag.find((c) => c.concept === "gym")?.reason).toBe("tag:gym wear");
    expect(fromStyle.map((c) => c.concept)).toContain("gym");
  });

  it("maps travel tag to travel", () => {
    const concepts = suggestOccasionConcepts({
      formality: null,
      tags: ["Travel"],
      styles: [],
      categoryName: null,
    }).map((c) => c.concept);
    expect(concepts).toContain("travel");
  });

  it("maps sleepwear category to home", () => {
    const concepts = suggestOccasionConcepts({
      formality: null,
      tags: [],
      styles: [],
      categoryName: "Sleepwear",
    }).map((c) => c.concept);
    expect(concepts).toContain("home");
  });

  it("dedupes concepts from multiple signals", () => {
    const concepts = suggestOccasionConcepts({
      formality: "business_casual",
      tags: ["office"],
      styles: [],
      categoryName: null,
    });
    expect(concepts.filter((c) => c.concept === "office")).toHaveLength(1);
  });

  it("returns empty for no signals", () => {
    expect(
      suggestOccasionConcepts({
        formality: null,
        tags: [],
        styles: [],
        categoryName: null,
      }),
    ).toEqual([]);
  });
});

describe("matchOccasionsToConcepts", () => {
  it("office matches both Office rows and Client Meeting", () => {
    const matches = matchOccasionsToConcepts(
      [{ concept: "office", reason: "formality:business_casual" }],
      LOOKUP,
    );
    expect(matches.map((m) => m.name).sort()).toEqual([
      "Client Meeting",
      "Office Daily",
      "Office Leadership",
    ]);
  });

  it("home matches Home and WFH", () => {
    const matches = matchOccasionsToConcepts(
      [{ concept: "home", reason: "formality:casual" }],
      LOOKUP,
    ).map((m) => m.name);
    expect(matches.sort()).toEqual(["Home", "WFH"]);
  });

  it("travel matches Travel, Airport, Vacation", () => {
    const matches = matchOccasionsToConcepts(
      [{ concept: "travel", reason: "tag:travel" }],
      LOOKUP,
    ).map((m) => m.name);
    expect(matches.sort()).toEqual(["Airport", "Travel", "Vacation"]);
  });

  it("never matches unrelated occasions (Brewery)", () => {
    const all = matchOccasionsToConcepts(
      [
        { concept: "office", reason: "r" },
        { concept: "home", reason: "r" },
        { concept: "gym", reason: "r" },
        { concept: "travel", reason: "r" },
        { concept: "wedding", reason: "r" },
      ],
      LOOKUP,
    ).map((m) => m.name);
    expect(all).not.toContain("Brewery");
  });

  it("dedupes an occasion matched by multiple concepts, keeping first reason", () => {
    const matches = matchOccasionsToConcepts(
      [
        { concept: "office", reason: "first" },
        { concept: "office", reason: "second" },
      ],
      LOOKUP,
    );
    expect(matches.filter((m) => m.id === "o1")).toHaveLength(1);
    expect(matches.find((m) => m.id === "o1")?.reason).toBe("first");
  });

  it("matching is case- and whitespace-insensitive", () => {
    const matches = matchOccasionsToConcepts(
      [{ concept: "gym", reason: "r" }],
      [{ id: "x", name: "  GYM  " }],
    );
    expect(matches).toHaveLength(1);
  });
});
