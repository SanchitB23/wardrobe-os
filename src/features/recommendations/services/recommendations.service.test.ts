import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/outfits/services/outfits.service", () => ({
  createOutfit: vi.fn(),
}));
vi.mock("@/features/wear-logs/repositories/wear-logs.repository", () => ({
  insertWearLogs: vi.fn(),
}));
vi.mock("@/features/outfits/repositories/outfits.repository", () => ({
  fetchOutfitItemLinks: vi.fn(),
}));

import {
  saveGeneratedOutfit,
  wearOutfitToday,
} from "@/features/recommendations/services/recommendations.service";
import { createOutfit } from "@/features/outfits/services/outfits.service";
import { insertWearLogs } from "@/features/wear-logs/repositories/wear-logs.repository";
import { fetchOutfitItemLinks } from "@/features/outfits/repositories/outfits.repository";
import type { RecommendedOutfitItem } from "@/domain/recommendation";

const createOutfitMock = vi.mocked(createOutfit);
const insertWearLogsMock = vi.mocked(insertWearLogs);
const fetchLinksMock = vi.mocked(fetchOutfitItemLinks);

function items(): RecommendedOutfitItem[] {
  return [
    { itemId: "top1", name: "Polo", slot: "top", category: "Top" },
    { itemId: "bottom1", name: "Chinos", slot: "bottom", category: "Bottom" },
    { itemId: "shoe1", name: "Sneakers", slot: "footwear", category: "Footwear" },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchLinksMock.mockResolvedValue({ data: [], error: null });
});

describe("saveGeneratedOutfit", () => {
  it("creates an outfit with the default generated name and mapped items", async () => {
    createOutfitMock.mockResolvedValue({
      data: { id: "new-id" },
      error: null,
    } as Awaited<ReturnType<typeof createOutfit>>);

    const result = await saveGeneratedOutfit(items());

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: "new-id", duplicate: false });
    expect(createOutfitMock).toHaveBeenCalledTimes(1);
    const arg = createOutfitMock.mock.calls[0][0];
    expect(arg.name).toMatch(/^Generated Outfit - \d{4}-\d{2}-\d{2}$/);
    expect(arg.items).toEqual([
      { item_id: "top1", slot: "top" },
      { item_id: "bottom1", slot: "bottom" },
      { item_id: "shoe1", slot: "footwear" },
    ]);
  });

  it("surfaces a save failure", async () => {
    createOutfitMock.mockResolvedValue({ data: null, error: new Error("db down") });

    const result = await saveGeneratedOutfit(items());

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("db down");
  });

  it("prevents duplicates when the same item set is already saved", async () => {
    fetchLinksMock.mockResolvedValue({
      data: [
        { outfit_id: "existing", item_id: "shoe1", role: "footwear" },
        { outfit_id: "existing", item_id: "top1", role: "top" },
        { outfit_id: "existing", item_id: "bottom1", role: "bottom" },
      ],
      error: null,
    });

    const result = await saveGeneratedOutfit(items());

    expect(result.data).toEqual({ id: "existing", duplicate: true });
    expect(createOutfitMock).not.toHaveBeenCalled();
  });

  it("rejects an empty outfit", async () => {
    const result = await saveGeneratedOutfit([]);
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(createOutfitMock).not.toHaveBeenCalled();
  });
});

describe("wearOutfitToday", () => {
  it("logs a wear for each item today (generated combo has no outfit id)", async () => {
    insertWearLogsMock.mockResolvedValue({
      data: [],
      error: null,
    } as Awaited<ReturnType<typeof insertWearLogs>>);

    const result = await wearOutfitToday(["top1", "bottom1", "shoe1"]);

    expect(result.error).toBeNull();
    const rows = insertWearLogsMock.mock.calls[0][0];
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.outfit_id === null)).toBe(true);
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.worn_on))).toBe(true);
  });

  it("passes the outfit id through for saved outfits", async () => {
    insertWearLogsMock.mockResolvedValue({
      data: [],
      error: null,
    } as Awaited<ReturnType<typeof insertWearLogs>>);

    await wearOutfitToday(["top1"], "outfit-9");
    expect(insertWearLogsMock.mock.calls[0][0][0].outfit_id).toBe("outfit-9");
  });

  it("surfaces a wear failure", async () => {
    insertWearLogsMock.mockResolvedValue({ data: null, error: new Error("insert failed") });
    const result = await wearOutfitToday(["top1"]);
    expect(result.error?.message).toBe("insert failed");
  });

  it("rejects when there are no items", async () => {
    const result = await wearOutfitToday([]);
    expect(result.error).toBeTruthy();
    expect(insertWearLogsMock).not.toHaveBeenCalled();
  });
});
