import { describe, expect, it } from "vitest";

import {
  recommendationExplanationParser,
  recommendationExplanationSchema,
} from "@/features/recommendations/ai/explanation.schema";

const validJson = JSON.stringify({
  summary: "A crisp smart-casual look.",
  whyThisWorks: "The navy and beige balance each other.",
  stylingTips: ["Cuff the chinos.", "Add a leather watch."],
  confidenceExplanation: "Scored high on color and formality harmony.",
  thingsToAvoid: ["Bulky sneakers."],
});

describe("recommendationExplanationParser", () => {
  it("parses a valid JSON response", () => {
    const result = recommendationExplanationParser.parse(validJson);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.summary).toContain("smart-casual");
      expect(result.data.stylingTips).toHaveLength(2);
    }
  });

  it("extracts JSON from a fenced code block with prose around it", () => {
    const raw = `Sure! Here you go:\n\`\`\`json\n${validJson}\n\`\`\`\nHope that helps.`;
    const result = recommendationExplanationParser.parse(raw);
    expect(result.ok).toBe(true);
  });

  it("fails when a required field is missing", () => {
    const missing = JSON.stringify({
      summary: "x",
      whyThisWorks: "y",
      stylingTips: [],
      // confidenceExplanation missing
      thingsToAvoid: [],
    });
    const result = recommendationExplanationParser.parse(missing);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("confidenceExplanation");
    }
  });

  it("fails when a field has the wrong type", () => {
    const wrong = JSON.stringify({
      summary: "x",
      whyThisWorks: "y",
      stylingTips: "not-an-array",
      confidenceExplanation: "z",
      thingsToAvoid: [],
    });
    const result = recommendationExplanationParser.parse(wrong);
    expect(result.ok).toBe(false);
  });

  it("fails when there is no JSON at all", () => {
    const result = recommendationExplanationParser.parse("I cannot help with that.");
    expect(result.ok).toBe(false);
  });

  it("exposes a jsonHint listing all five fields", () => {
    const hint = recommendationExplanationSchema.jsonHint ?? "";
    for (const field of [
      "summary",
      "whyThisWorks",
      "stylingTips",
      "confidenceExplanation",
      "thingsToAvoid",
    ]) {
      expect(hint).toContain(field);
    }
  });
});
