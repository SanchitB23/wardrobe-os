/**
 * Domain tests — Quick Log slot selection → wear-event entries (RFC-023 follow-up).
 */

import { describe, expect, it } from "vitest";

import { buildWearLogSlotEntries } from "@/domain/wear-logs";

const ORDER = ["top", "bottom", "footwear", "accessory"] as const;

describe("buildWearLogSlotEntries", () => {
  it("maps one item per slot in slot order", () => {
    const entries = buildWearLogSlotEntries(
      { top: ["t1"], bottom: ["b1"], footwear: ["f1"] },
      ORDER,
    );
    expect(entries).toEqual([
      { itemId: "t1", slot: "top" },
      { itemId: "b1", slot: "bottom" },
      { itemId: "f1", slot: "footwear" },
    ]);
  });

  it("keeps multiple items within one slot", () => {
    const entries = buildWearLogSlotEntries(
      { top: ["under", "over"], accessory: ["watch", "ring"] },
      ORDER,
    );
    expect(entries).toEqual([
      { itemId: "under", slot: "top" },
      { itemId: "over", slot: "top" },
      { itemId: "watch", slot: "accessory" },
      { itemId: "ring", slot: "accessory" },
    ]);
  });

  it("appends slot-less extras and de-dupes (slotted wins)", () => {
    const entries = buildWearLogSlotEntries(
      { top: ["t1"] },
      ORDER,
      ["x1", "t1"],
    );
    expect(entries).toEqual([
      { itemId: "t1", slot: "top" },
      { itemId: "x1", slot: null },
    ]);
  });

  it("skips empty/undefined slot arrays and empty ids", () => {
    const entries = buildWearLogSlotEntries(
      { top: [], bottom: undefined, footwear: [""] },
      ORDER,
    );
    expect(entries).toEqual([]);
  });

  it("de-dupes a repeated id across slots (first occurrence wins)", () => {
    const entries = buildWearLogSlotEntries(
      { top: ["dup"], accessory: ["dup"] },
      ORDER,
    );
    expect(entries).toEqual([{ itemId: "dup", slot: "top" }]);
  });
});
