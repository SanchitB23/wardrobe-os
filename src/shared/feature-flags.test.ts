import { describe, expect, it } from "vitest";

import { resolveFeatureFlags } from "@/shared/feature-flags";

describe("resolveFeatureFlags", () => {
  it("marks configured vs default and masks secrets", () => {
    const flags = resolveFeatureFlags({
      LOG_LEVEL: "debug",
      APP_ACCESS_CODE: "hunter2",
    });
    const level = flags.find((f) => f.key === "LOG_LEVEL");
    expect(level?.configured).toBe(true);
    expect(level?.displayValue).toBe("debug");

    const access = flags.find((f) => f.key === "APP_ACCESS_CODE");
    expect(access?.configured).toBe(true);
    expect(access?.displayValue).toBe("••••set");
    expect(access?.displayValue).not.toContain("hunter2");

    const replay = flags.find((f) => f.key === "REPLAY_CAPTURE");
    expect(replay?.configured).toBe(false);
    expect(replay?.displayValue).toBe("false");
  });
});
