import { describe, expect, it } from "vitest";

import { normalizeOccasion, resolveStyleOccasion } from "@/domain/outfit";

describe("resolveStyleOccasion", () => {
  it("maps social aliases (including brunch) to 'social'", () => {
    for (const alias of ["dinner", "date", "brewery", "party", "brunch", "social"]) {
      expect(resolveStyleOccasion(alias)).toBe("social");
    }
  });

  it("recognizes brunch consistently (regression: previously unrecognized in 2 of 3 engines)", () => {
    expect(resolveStyleOccasion("brunch")).toBe("social");
    expect(resolveStyleOccasion("BRUNCH")).toBe("social");
    expect(resolveStyleOccasion("  Brunch  ")).toBe("social");
  });

  it("maps the remaining occasion families", () => {
    expect(resolveStyleOccasion("gym")).toBe("gym");
    expect(resolveStyleOccasion("workout")).toBe("gym");
    expect(resolveStyleOccasion("office")).toBe("office");
    expect(resolveStyleOccasion("work")).toBe("office");
    expect(resolveStyleOccasion("Business")).toBe("office"); // trip-strategy default
    expect(resolveStyleOccasion("Meetings")).toBe("office"); // trip-template events
    expect(resolveStyleOccasion("wedding")).toBe("wedding");
    expect(resolveStyleOccasion("formal")).toBe("wedding");
    expect(resolveStyleOccasion("travel")).toBe("travel");
    expect(resolveStyleOccasion("smart casual")).toBe("smartCasual");
    expect(resolveStyleOccasion("home")).toBe("home");
    expect(resolveStyleOccasion("casual")).toBe("casual");
  });

  it("returns null for empty or unknown labels", () => {
    expect(resolveStyleOccasion(null)).toBeNull();
    expect(resolveStyleOccasion(undefined)).toBeNull();
    expect(resolveStyleOccasion("")).toBeNull();
    expect(resolveStyleOccasion("nonsense")).toBeNull();
  });
});

describe("normalizeOccasion", () => {
  it("lowercases and trims", () => {
    expect(normalizeOccasion("  Dinner ")).toBe("dinner");
    expect(normalizeOccasion(null)).toBe("");
  });
});
