import { describe, expect, it } from "vitest";

import { diffIds } from "@/domain/inventory-relations";

describe("diffIds", () => {
  it("computes inserts and deletes", () => {
    expect(diffIds(["a", "b"], ["b", "c"])).toEqual({
      toInsert: ["c"],
      toDelete: ["a"],
    });
  });

  it("returns empty diff for identical sets", () => {
    expect(diffIds(["a", "b"], ["b", "a"])).toEqual({
      toInsert: [],
      toDelete: [],
    });
  });

  it("handles empty current (all inserts)", () => {
    expect(diffIds([], ["a"])).toEqual({ toInsert: ["a"], toDelete: [] });
  });

  it("handles empty next (all deletes)", () => {
    expect(diffIds(["a"], [])).toEqual({ toInsert: [], toDelete: ["a"] });
  });

  it("dedupes repeated ids in next", () => {
    expect(diffIds([], ["a", "a"])).toEqual({ toInsert: ["a"], toDelete: [] });
  });
});
