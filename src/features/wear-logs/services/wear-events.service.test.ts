/**
 * Service-level tests for wear events (RFC-023) — mocked repositories.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/wear-logs/repositories/wear-events.repository", () => ({
  insertWearEvent: vi.fn(),
  dualWriteLegacyWearLogs: vi.fn(),
  countWearEventsByCombinationKey: vi.fn(),
  selectWearEventById: vi.fn(),
  updateWearEvent: vi.fn(),
  replaceWearEventItems: vi.fn(),
  selectWearEvents: vi.fn(),
  countCombinationFrequencies: vi.fn(),
  deleteWearEvent: vi.fn(),
}));

vi.mock("@/features/outfits/services/outfits.service", () => ({
  createOutfit: vi.fn(),
  setOutfitFavorite: vi.fn(),
}));

vi.mock("@/features/wear-logs/repositories/wear-logs.repository", () => ({
  fetchWardrobeItemsByIds: vi.fn(),
  fetchOccasionsByIds: vi.fn(),
  fetchAllCategories: vi.fn(),
}));

import * as wearEventsRepository from "@/features/wear-logs/repositories/wear-events.repository";
import {
  createAdHocWearLog,
  createWearLogFromOutfit,
  createWearLogFromRecommendation,
  promoteWearLogToOutfit,
} from "@/features/wear-logs/services/wear-events.service";
import { createOutfit, setOutfitFavorite } from "@/features/outfits/services/outfits.service";
import { buildCombinationKey } from "@/domain/wear-logs";

const insertWearEvent = vi.mocked(wearEventsRepository.insertWearEvent);
const dualWrite = vi.mocked(wearEventsRepository.dualWriteLegacyWearLogs);
const countByKey = vi.mocked(
  wearEventsRepository.countWearEventsByCombinationKey,
);
const selectById = vi.mocked(wearEventsRepository.selectWearEventById);
const updateEvent = vi.mocked(wearEventsRepository.updateWearEvent);
const createOutfitMock = vi.mocked(createOutfit);
const setFavoriteMock = vi.mocked(setOutfitFavorite);

function eventFixture(itemIds: string[], source: "ad_hoc" | "outfit" | "recommendation" = "ad_hoc") {
  const key = buildCombinationKey(itemIds);
  return {
    event: {
      id: "evt-1",
      worn_on: "2026-07-12",
      occasion_id: null,
      outfit_id: source === "outfit" ? "outfit-1" : null,
      source,
      notes: null,
      weather: null,
      combination_key: key,
      created_at: "2026-07-12T10:00:00Z",
    },
    items: itemIds.map((id, index) => ({
      wear_event_id: "evt-1",
      item_id: id,
      slot: index === 0 ? "top" : "bottom",
      sort_order: index,
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dualWrite.mockResolvedValue({ data: [], error: null });
  countByKey.mockResolvedValue({ data: 1, error: null });
});

describe("createAdHocWearLog", () => {
  it("creates event without outfit and dual-writes analytics", async () => {
    const fixture = eventFixture(["a", "b"], "ad_hoc");
    insertWearEvent.mockResolvedValue({ data: fixture, error: null });
    countByKey.mockResolvedValue({ data: 3, error: null });

    const result = await createAdHocWearLog({
      wornOn: "2026-07-12",
      items: [{ itemId: "a", slot: "top" }, { itemId: "b", slot: "bottom" }],
    });

    expect(result.error).toBeNull();
    expect(result.data?.wearLog.outfitId).toBeNull();
    expect(result.data?.wearLog.source).toBe("ad_hoc");
    expect(result.data?.suggestion.shouldSuggestPromote).toBe(true);
    expect(dualWrite).toHaveBeenCalled();
    expect(insertWearEvent.mock.calls[0]?.[0].outfit_id).toBeNull();
  });
});

describe("createWearLogFromOutfit", () => {
  it("requires outfit id and sets source=outfit", async () => {
    const fixture = eventFixture(["a", "b"], "outfit");
    insertWearEvent.mockResolvedValue({ data: fixture, error: null });

    const result = await createWearLogFromOutfit({
      outfitId: "outfit-1",
      wornOn: "2026-07-12",
      items: [{ itemId: "a" }, { itemId: "b" }],
    });

    expect(result.error).toBeNull();
    expect(result.data?.wearLog.source).toBe("outfit");
    expect(result.data?.suggestion.shouldSuggestPromote).toBe(false);
    expect(insertWearEvent.mock.calls[0]?.[0].source).toBe("outfit");
  });
});

describe("createWearLogFromRecommendation", () => {
  it("sets source=recommendation", async () => {
    const fixture = eventFixture(["a"], "recommendation");
    insertWearEvent.mockResolvedValue({ data: fixture, error: null });

    const result = await createWearLogFromRecommendation({
      wornOn: "2026-07-12",
      items: [{ itemId: "a", slot: "top" }],
    });

    expect(result.error).toBeNull();
    expect(result.data?.wearLog.source).toBe("recommendation");
    expect(result.data?.suggestion.shouldSuggestPromote).toBe(false); // single item
  });
});

describe("promoteWearLogToOutfit", () => {
  it("creates outfit, optional favorite, and links wear log", async () => {
    const fixture = eventFixture(["a", "b"], "ad_hoc");
    selectById.mockResolvedValue({ data: fixture, error: null });
    createOutfitMock.mockResolvedValue({
      data: {
        id: "new-outfit",
        name: "Brunch set",
        occasion_id: null,
        season: null,
        rating: null,
        notes: null,
        favorite: false,
        created_at: null,
      },
      error: null,
    });
    setFavoriteMock.mockResolvedValue({
      data: {
        id: "new-outfit",
        name: "Brunch set",
        occasion_id: null,
        season: null,
        rating: null,
        notes: null,
        favorite: true,
        created_at: null,
      },
      error: null,
    });
    updateEvent.mockResolvedValue({
      data: { ...fixture.event, outfit_id: "new-outfit" },
      error: null,
    });

    const result = await promoteWearLogToOutfit({
      wearLogId: "evt-1",
      name: "Brunch set",
      favorite: true,
      tags: ["weekend"],
    });

    expect(result.error).toBeNull();
    expect(result.data?.outfitId).toBe("new-outfit");
    expect(createOutfitMock).toHaveBeenCalled();
    expect(setFavoriteMock).toHaveBeenCalledWith("new-outfit", true);
    expect(updateEvent).toHaveBeenCalledWith("evt-1", {
      outfit_id: "new-outfit",
    });
  });
});
