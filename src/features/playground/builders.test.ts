import { describe, expect, it } from "vitest";

import { PLAYGROUND_BUILDERS, getPlaygroundBuilder } from "@/features/playground/builders";

describe("PLAYGROUND_BUILDERS", () => {
  it("exposes the three predefined samples", () => {
    const ids = PLAYGROUND_BUILDERS.map((b) => b.id);
    expect(ids).toEqual([
      "recommendation-explanation",
      "wardrobe-health-summary",
      "insight-summary",
    ]);
  });

  it.each(PLAYGROUND_BUILDERS)("$id builds a prompt from its sample input", (builder) => {
    const built = builder.build(builder.sampleInput);
    expect(built.system && built.system.length).toBeTruthy();
    expect(built.prompt.length).toBeGreaterThan(0);
    // Schema instructions get appended by the prompt builder.
    expect(built.prompt).toMatch(/JSON/i);
    expect(built.schema?.name).toBe(builder.schema.name);
  });

  it("each schema validates a well-formed sample of its own output shape", () => {
    const samples: Record<string, unknown> = {
      "recommendation-explanation": {
        summary: "s",
        whyThisWorks: "w",
        stylingTips: [],
        confidenceExplanation: "c",
        thingsToAvoid: [],
      },
      "wardrobe-health-summary": { summary: "s", priorities: [], quickWins: [] },
      "insight-summary": { headline: "h", themes: [], topActions: [] },
    };
    for (const builder of PLAYGROUND_BUILDERS) {
      const result = builder.schema.validate(samples[builder.id]);
      expect(result.valid).toBe(true);
    }
  });

  it("getPlaygroundBuilder resolves by id and returns undefined otherwise", () => {
    expect(getPlaygroundBuilder("insight-summary")?.label).toBe("Insight summary");
    expect(getPlaygroundBuilder("nope")).toBeUndefined();
  });
});
