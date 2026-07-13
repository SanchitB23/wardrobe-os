import { describe, expect, it } from "vitest";

import { parseVisionItems } from "@/ai/vision/parse-vision-items";

describe("parseVisionItems", () => {
  it("parses a plain JSON object", () => {
    expect(parseVisionItems('{"items":[{"label":"shirt"}]}')).toEqual([{ label: "shirt" }]);
  });

  it("parses fenced JSON", () => {
    expect(parseVisionItems('```json\n{"items":[{"label":"shoe"}]}\n```')).toEqual([
      { label: "shoe" },
    ]);
  });

  it("parses JSON embedded in prose", () => {
    expect(parseVisionItems('Here you go: {"items":[{"label":"hat"}]} done')).toEqual([
      { label: "hat" },
    ]);
  });

  it("returns [] for null/empty/garbage", () => {
    expect(parseVisionItems(null)).toEqual([]);
    expect(parseVisionItems("")).toEqual([]);
    expect(parseVisionItems("not json")).toEqual([]);
  });
});
