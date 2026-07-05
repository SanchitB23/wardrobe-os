import { describe, expect, it } from "vitest";

import { interpretStylesHealthCheck } from "@/domain/wardrobe/wardrobe-health";

describe("WardrobeHealth", () => {
  it("reports disconnected when the health check errors", () => {
    const result = interpretStylesHealthCheck(null, new Error("Network failure"));

    expect(result).toEqual({
      connected: false,
      rlsBlocking: false,
      errorMessage: "Network failure",
      styles: null,
    });
  });

  it("flags RLS blocking when connected but styles sample is empty", () => {
    const result = interpretStylesHealthCheck([], null);

    expect(result).toEqual({
      connected: true,
      rlsBlocking: true,
      errorMessage: null,
      styles: [],
    });
  });

  it("reports healthy when styles are returned", () => {
    const styles = [{ name: "Classic" }, { name: "Minimal" }];
    const result = interpretStylesHealthCheck(styles, null);

    expect(result).toEqual({
      connected: true,
      rlsBlocking: false,
      errorMessage: null,
      styles: [{ name: "Classic" }, { name: "Minimal" }],
    });
  });

  it("treats null styles as an empty sample", () => {
    const result = interpretStylesHealthCheck(null, null);

    expect(result.connected).toBe(true);
    expect(result.rlsBlocking).toBe(true);
    expect(result.styles).toEqual([]);
  });
});
