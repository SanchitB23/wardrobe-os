import type { OutfitSlot, OutfitSlotDefinition } from "@/types/wardrobe";

export const OUTFIT_SLOT_DEFINITIONS: OutfitSlotDefinition[] = [
  {
    slot: "top",
    label: "Top",
    optional: false,
    categoryKeywords: ["top", "shirt", "tee", "blouse", "sweater", "hoodie", "knit"],
  },
  {
    slot: "bottom",
    label: "Bottom",
    optional: false,
    categoryKeywords: ["bottom", "pant", "trouser", "jean", "short", "skirt"],
  },
  {
    slot: "footwear",
    label: "Footwear",
    optional: false,
    categoryKeywords: ["footwear", "shoe", "sneaker", "boot", "loafer"],
  },
  {
    slot: "outerwear",
    label: "Outerwear",
    optional: true,
    categoryKeywords: ["outerwear", "jacket", "coat", "blazer", "vest"],
  },
  {
    slot: "watch",
    label: "Watch",
    optional: true,
    categoryKeywords: ["watch", "watches"],
  },
  {
    slot: "belt",
    label: "Belt",
    optional: true,
    categoryKeywords: ["belt", "belts"],
  },
  {
    slot: "fragrance",
    label: "Fragrance",
    optional: true,
    categoryKeywords: ["fragrance", "cologne", "perfume", "scent"],
  },
  {
    slot: "accessory",
    label: "Accessory",
    optional: true,
    categoryKeywords: ["accessory", "accessories", "hat", "scarf", "bag", "tie"],
  },
];

export function categoryMatchesOutfitSlot(
  categoryName: string | null | undefined,
  slot: OutfitSlot,
): boolean {
  if (!categoryName) {
    return false;
  }

  const normalized = categoryName.toLowerCase();
  const definition = OUTFIT_SLOT_DEFINITIONS.find((entry) => entry.slot === slot);

  if (!definition) {
    return false;
  }

  return definition.categoryKeywords.some((keyword) =>
    normalized.includes(keyword),
  );
}

export function getRequiredOutfitSlots(): OutfitSlot[] {
  return OUTFIT_SLOT_DEFINITIONS.filter((definition) => !definition.optional).map(
    (definition) => definition.slot,
  );
}

export function getOptionalOutfitSlots(): OutfitSlot[] {
  return OUTFIT_SLOT_DEFINITIONS.filter((definition) => definition.optional).map(
    (definition) => definition.slot,
  );
}
