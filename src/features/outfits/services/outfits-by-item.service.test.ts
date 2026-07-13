import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the repository layer the outfits service depends on.
const fetchOutfitRows = vi.fn();
const fetchOutfitItemLinks = vi.fn();
const fetchOccasions = vi.fn();
const fetchSeasons = vi.fn();
vi.mock("@/features/outfits/repositories/outfits.repository", () => ({
  fetchOutfitRows: (...args: unknown[]) => fetchOutfitRows(...args),
  fetchOutfitItemLinks: (...args: unknown[]) => fetchOutfitItemLinks(...args),
  fetchOccasions: (...args: unknown[]) => fetchOccasions(...args),
  fetchSeasons: (...args: unknown[]) => fetchSeasons(...args),
}));

import { listOutfitsContainingItem } from "@/features/outfits/services/outfits.service";

const outfitRow = (id: string, name: string) => ({
  id,
  name,
  occasion_id: null,
  season: null,
  rating: null,
  notes: null,
  favorite: false,
  created_at: "2026-01-01T00:00:00Z",
});

beforeEach(() => {
  fetchOutfitRows.mockReset();
  fetchOutfitItemLinks.mockReset();
  fetchOccasions.mockReset().mockResolvedValue({ data: [], error: null });
  fetchSeasons.mockReset().mockResolvedValue({ data: [], error: null });
});

describe("listOutfitsContainingItem", () => {
  it("returns only outfits that contain the item", async () => {
    fetchOutfitRows.mockResolvedValue({
      data: [outfitRow("o1", "Office Monday"), outfitRow("o2", "Weekend Casual")],
      error: null,
    });
    fetchOutfitItemLinks.mockResolvedValue({
      data: [
        { outfit_id: "o1", item_id: "a1", role: "top" },
        { outfit_id: "o1", item_id: "b1", role: "bottom" },
        { outfit_id: "o2", item_id: "b1", role: "bottom" },
      ],
      error: null,
    });

    const result = await listOutfitsContainingItem("a1");

    expect(result.error).toBeNull();
    expect(result.data?.map((o) => o.id)).toEqual(["o1"]);
  });

  it("returns an empty list when no outfit features the item", async () => {
    fetchOutfitRows.mockResolvedValue({ data: [outfitRow("o1", "Office Monday")], error: null });
    fetchOutfitItemLinks.mockResolvedValue({
      data: [{ outfit_id: "o1", item_id: "b1", role: "bottom" }],
      error: null,
    });

    const result = await listOutfitsContainingItem("a1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("propagates repository errors", async () => {
    fetchOutfitRows.mockResolvedValue({ data: null, error: new Error("boom") });
    fetchOutfitItemLinks.mockResolvedValue({ data: [], error: null });

    const result = await listOutfitsContainingItem("a1");

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("boom");
  });
});
