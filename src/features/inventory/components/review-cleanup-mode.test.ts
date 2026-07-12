import { describe, expect, it } from "vitest";

import { resolveCleanupMode } from "@/features/inventory/components/review-cleanup-dialog";

describe("resolveCleanupMode", () => {
  it("defaults to retire without hard-delete opt-in", () => {
    expect(resolveCleanupMode(false)).toBe("retire");
  });

  it("requires explicit confirmation opt-in for hard delete", () => {
    expect(resolveCleanupMode(true)).toBe("hard_delete");
  });
});
