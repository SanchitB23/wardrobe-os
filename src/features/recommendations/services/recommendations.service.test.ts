import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/outfits/services/outfits.service", () => ({
  createOutfit: vi.fn(),
}));
vi.mock("@/features/wear-logs/services/wear-events.service", () => ({
  createWearLogFromRecommendation: vi.fn(),
  createWearLogFromOutfit: vi.fn(),
}));
vi.mock("@/features/outfits/repositories/outfits.repository", () => ({
  fetchOutfitItemLinks: vi.fn(),
}));

import {
  saveGeneratedOutfit,
  wearOutfitToday,
} from "@/features/recommendations/services/recommendations.service";
import { createOutfit } from "@/features/outfits/services/outfits.service";
import {
  createWearLogFromOutfit,
  createWearLogFromRecommendation,
} from "@/features/wear-logs/services/wear-events.service";
import { fetchOutfitItemLinks } from "@/features/outfits/repositories/outfits.repository";
import type { RecommendedOutfitItem } from "@/domain/recommendation";

const createOutfitMock = vi.mocked(createOutfit);
const createFromRecMock = vi.mocked(createWearLogFromRecommendation);
const createFromOutfitMock = vi.mocked(createWearLogFromOutfit);
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
  it("logs a recommendation wear for generated combos (no outfit id)", async () => {
    createFromRecMock.mockResolvedValue({
      data: {
        wearLog: {
          id: "e1",
          wornOn: "2026-07-12",
          occasionId: null,
          outfitId: null,
          source: "recommendation",
          notes: null,
          weather: null,
          combinationKey: "k",
          items: [],
          createdAt: "2026-07-12T00:00:00Z",
        },
        suggestion: {
          combinationKey: "k",
          count: 1,
          threshold: 3,
          itemCount: 3,
          shouldSuggestPromote: false,
        },
      },
      error: null,
    });

    const result = await wearOutfitToday(["top1", "bottom1", "shoe1"]);

    expect(result.error).toBeNull();
    expect(createFromRecMock).toHaveBeenCalledTimes(1);
    const arg = createFromRecMock.mock.calls[0][0];
    expect(arg.items).toHaveLength(3);
    expect(arg.outfitId).toBeNull();
    expect(/^\d{4}-\d{2}-\d{2}$/.test(arg.wornOn)).toBe(true);
    expect(createFromOutfitMock).not.toHaveBeenCalled();
  });

  it("uses outfit wear path when outfit id is provided", async () => {
    createFromOutfitMock.mockResolvedValue({
      data: {
        wearLog: {
          id: "e1",
          wornOn: "2026-07-12",
          occasionId: null,
          outfitId: "outfit-9",
          source: "outfit",
          notes: null,
          weather: null,
          combinationKey: "k",
          items: [],
          createdAt: "2026-07-12T00:00:00Z",
        },
        suggestion: {
          combinationKey: "k",
          count: 1,
          threshold: 3,
          itemCount: 1,
          shouldSuggestPromote: false,
        },
      },
      error: null,
    });

    await wearOutfitToday(["top1"], "outfit-9");
    expect(createFromOutfitMock.mock.calls[0][0].outfitId).toBe("outfit-9");
    expect(createFromRecMock).not.toHaveBeenCalled();
  });

  it("surfaces a wear failure", async () => {
    createFromRecMock.mockResolvedValue({
      data: null,
      error: new Error("insert failed"),
    });
    const result = await wearOutfitToday(["top1"]);
    expect(result.error?.message).toBe("insert failed");
  });

  it("rejects when there are no items", async () => {
    const result = await wearOutfitToday([]);
    expect(result.error).toBeTruthy();
    expect(createFromRecMock).not.toHaveBeenCalled();
  });
});
