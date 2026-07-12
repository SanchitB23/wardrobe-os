import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the repository layer the service depends on.
const selectBrands = vi.fn();
const insertBrand = vi.fn();
vi.mock("@/features/inventory/repositories/inventory.repository", () => ({
  selectBrands: (...args: unknown[]) => selectBrands(...args),
  insertBrand: (...args: unknown[]) => insertBrand(...args),
}));

import { createBrand } from "@/features/inventory/services/inventory.service";

beforeEach(() => {
  selectBrands.mockReset();
  insertBrand.mockReset();
});

describe("createBrand", () => {
  it("rejects empty / whitespace-only names without inserting", async () => {
    const result = await createBrand("   ");
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(insertBrand).not.toHaveBeenCalled();
  });

  it("returns the existing brand (no insert) when a normalized match exists", async () => {
    selectBrands.mockResolvedValue({
      data: [{ id: "b1", name: "Uniqlo" }],
      error: null,
    });
    const result = await createBrand("  uniqlo ");
    expect(result.data).toEqual({ id: "b1", name: "Uniqlo" });
    expect(insertBrand).not.toHaveBeenCalled();
  });

  it("inserts a new brand with preserved casing when no match", async () => {
    selectBrands.mockResolvedValue({ data: [], error: null });
    insertBrand.mockResolvedValue({
      data: { id: "b9", name: "ASICS" },
      error: null,
    });
    const result = await createBrand("  ASICS ");
    expect(insertBrand).toHaveBeenCalledWith("ASICS");
    expect(result.data).toEqual({ id: "b9", name: "ASICS" });
  });

  it("recovers from a unique-index violation by returning the existing row", async () => {
    // First fetch: empty (race). Insert: unique violation. Re-fetch: now present.
    selectBrands
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ id: "b1", name: "Uniqlo" }],
        error: null,
      });
    insertBrand.mockResolvedValue({
      data: null,
      error: "duplicate key value violates unique constraint \"brands_name_ci_unique\"",
    });
    const result = await createBrand("Uniqlo");
    expect(result.data).toEqual({ id: "b1", name: "Uniqlo" });
    expect(result.error).toBeNull();
  });
});
