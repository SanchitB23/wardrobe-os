import { describe, expect, it } from "vitest";

import { findBrandByName, normalizeBrandName } from "@/domain/lookups";

describe("normalizeBrandName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeBrandName("  Uniqlo  ")).toBe("Uniqlo");
    expect(normalizeBrandName("North   Face")).toBe("North Face");
  });

  it("preserves user casing", () => {
    expect(normalizeBrandName("adidas")).toBe("adidas");
    expect(normalizeBrandName("ASICS")).toBe("ASICS");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeBrandName("   ")).toBe("");
    expect(normalizeBrandName("")).toBe("");
  });
});

describe("findBrandByName", () => {
  const options = [
    { id: "b1", name: "Uniqlo" },
    { id: "b2", name: "Nike" },
    { id: "b3", name: "The North Face" },
  ];

  it("matches case-insensitively", () => {
    expect(findBrandByName("uniqlo", options)?.id).toBe("b1");
    expect(findBrandByName("UNIQLO", options)?.id).toBe("b1");
  });

  it("matches whitespace-insensitively", () => {
    expect(findBrandByName("  nike ", options)?.id).toBe("b2");
    expect(findBrandByName("The  North   Face", options)?.id).toBe("b3");
  });

  it("does NOT partial-match (stricter than matchLookupId)", () => {
    expect(findBrandByName("Nike ACG", options)).toBeNull();
    expect(findBrandByName("North Face", options)).toBeNull(); // "The North Face" ≠ "North Face"
  });

  it("returns null for empty input", () => {
    expect(findBrandByName("", options)).toBeNull();
    expect(findBrandByName("   ", options)).toBeNull();
  });

  it("returns null when no option matches", () => {
    expect(findBrandByName("Zara", options)).toBeNull();
  });
});
