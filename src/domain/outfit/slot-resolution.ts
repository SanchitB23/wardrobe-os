/**
 * Canonical outfit-slot resolution (RFC-030) — the single source of truth for
 * mapping category/subcategory/name text to an {@link OutfitSlot}. Pure and
 * deterministic. Consumed by slot-matching helpers, StyleDNAEngine, and
 * VisionNormalizer so inventory and vision classify garments identically.
 *
 * Resolution tiers (first hit wins):
 *  1. exact   — curated dictionary lookup per part (whole phrase, then token
 *               bigrams, then unigrams; bigrams outrank unigrams so
 *               "oxford shirt" → top while "oxfords" → footwear).
 *  2. keyword — legacy substring scan over the concatenated parts, unchanged
 *               slot order (back-compat safety net).
 *  3. fallback — accessory, flagged via `source` so degradation is observable.
 */

import type { OutfitSlot, OutfitSlotDefinition } from "@/types/wardrobe";

export type SlotResolutionSource = "exact" | "keyword" | "fallback";

export type SlotResolution = {
  slot: OutfitSlot;
  source: SlotResolutionSource;
};

export const OUTFIT_SLOT_DEFINITIONS: OutfitSlotDefinition[] = [
  {
    slot: "top",
    label: "Top",
    optional: false,
    categoryKeywords: ["top", "shirt", "tee", "blouse", "sweater", "hoodie", "knit", "polo"],
  },
  {
    slot: "bottom",
    label: "Bottom",
    optional: false,
    categoryKeywords: ["bottom", "pant", "trouser", "jean", "short", "skirt", "chino", "jogger", "legging"],
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

/**
 * Exact-match dictionary: normalised singular term → slot. Multi-word keys are
 * matched as whole phrases or token bigrams before any unigram, which is how
 * ambiguous words get disambiguated ("oxford shirt" vs "oxford").
 */
export const CANONICAL_SLOT_TERMS: Readonly<Record<string, OutfitSlot>> = {
  // --- top -----------------------------------------------------------------
  top: "top",
  "t shirt": "top",
  tshirt: "top",
  tee: "top",
  shirt: "top",
  "oxford shirt": "top",
  "dress shirt": "top",
  "denim shirt": "top",
  "flannel shirt": "top",
  "linen shirt": "top",
  polo: "top",
  "polo shirt": "top",
  henley: "top",
  turtleneck: "top",
  sweatshirt: "top",
  sweater: "top",
  jumper: "top",
  pullover: "top",
  crewneck: "top",
  hoodie: "top",
  kurta: "top",
  "tank top": "top",
  jersey: "top",
  blouse: "top",
  camisole: "top",
  "crop top": "top",
  knit: "top",
  // --- bottom ---------------------------------------------------------------
  bottom: "bottom",
  chino: "bottom",
  jean: "bottom",
  pant: "bottom",
  trouser: "bottom",
  short: "bottom",
  skirt: "bottom",
  jogger: "bottom",
  legging: "bottom",
  sweatpant: "bottom",
  cargo: "bottom",
  "cargo pant": "bottom",
  "track pant": "bottom",
  trackpant: "bottom",
  "boot cut": "bottom",
  bootcut: "bottom",
  culotte: "bottom",
  dhoti: "bottom",
  pyjama: "bottom",
  pajama: "bottom",
  // --- footwear ---------------------------------------------------------------
  footwear: "footwear",
  shoe: "footwear",
  sneaker: "footwear",
  trainer: "footwear",
  boot: "footwear",
  "chelsea boot": "footwear",
  "chukka boot": "footwear",
  chukka: "footwear",
  loafer: "footwear",
  oxford: "footwear",
  derby: "footwear",
  brogue: "footwear",
  "monk strap": "footwear",
  sandal: "footwear",
  slide: "footwear",
  "flip flop": "footwear",
  espadrille: "footwear",
  moccasin: "footwear",
  "boat shoe": "footwear",
  heel: "footwear",
  mule: "footwear",
  slipper: "footwear",
  clog: "footwear",
  jutti: "footwear",
  kolhapuri: "footwear",
  // --- outerwear --------------------------------------------------------------
  outerwear: "outerwear",
  jacket: "outerwear",
  coat: "outerwear",
  blazer: "outerwear",
  overcoat: "outerwear",
  trench: "outerwear",
  "trench coat": "outerwear",
  parka: "outerwear",
  puffer: "outerwear",
  windbreaker: "outerwear",
  windcheater: "outerwear",
  gilet: "outerwear",
  vest: "outerwear",
  waistcoat: "outerwear",
  cardigan: "outerwear",
  overshirt: "outerwear",
  shacket: "outerwear",
  bomber: "outerwear",
  anorak: "outerwear",
  raincoat: "outerwear",
  tuxedo: "outerwear",
  suit: "outerwear",
  "suit jacket": "outerwear",
  sherwani: "outerwear",
  // --- watch ---------------------------------------------------------------
  watch: "watch",
  smartwatch: "watch",
  wristwatch: "watch",
  // --- belt ---------------------------------------------------------------
  belt: "belt",
  // --- fragrance --------------------------------------------------------------
  fragrance: "fragrance",
  perfume: "fragrance",
  cologne: "fragrance",
  attar: "fragrance",
  deodorant: "fragrance",
  "eau de parfum": "fragrance",
  "eau de toilette": "fragrance",
  scent: "fragrance",
  // --- accessory --------------------------------------------------------------
  accessory: "accessory",
  hat: "accessory",
  cap: "accessory",
  beanie: "accessory",
  scarf: "accessory",
  bag: "accessory",
  backpack: "accessory",
  tote: "accessory",
  tie: "accessory",
  "bow tie": "accessory",
  necktie: "accessory",
  "pocket square": "accessory",
  sunglasses: "accessory",
  glasses: "accessory",
  wallet: "accessory",
  bracelet: "accessory",
  ring: "accessory",
  necklace: "accessory",
  chain: "accessory",
  cufflink: "accessory",
  sock: "accessory",
  glove: "accessory",
  umbrella: "accessory",
};

function normalizeSlotText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Dictionary lookup with naive plural folding (…ies → …y, …es, …s). */
function lookupTerm(term: string): OutfitSlot | undefined {
  const direct = CANONICAL_SLOT_TERMS[term];
  if (direct) return direct;
  if (term.endsWith("ies")) {
    const fold = CANONICAL_SLOT_TERMS[`${term.slice(0, -3)}y`];
    if (fold) return fold;
  }
  if (term.endsWith("es")) {
    const fold = CANONICAL_SLOT_TERMS[term.slice(0, -2)];
    if (fold) return fold;
  }
  if (term.endsWith("s")) {
    const fold = CANONICAL_SLOT_TERMS[term.slice(0, -1)];
    if (fold) return fold;
  }
  return undefined;
}

/**
 * Whole phrase, then bigrams, then unigrams. Token scans run right-to-left:
 * garment noun phrases are head-final ("short sleeve shirt", "tie-dye
 * hoodie"), so the rightmost match is the garment itself.
 */
function exactLookup(phrase: string): OutfitSlot | undefined {
  const whole = lookupTerm(phrase);
  if (whole) return whole;
  const tokens = phrase.split(" ").filter(Boolean);
  for (let i = tokens.length - 2; i >= 0; i--) {
    const bigram = lookupTerm(`${tokens[i]} ${tokens[i + 1]}`);
    if (bigram) return bigram;
  }
  for (let i = tokens.length - 1; i >= 0; i--) {
    const unigram = lookupTerm(tokens[i]);
    if (unigram) return unigram;
  }
  return undefined;
}

/**
 * Resolves free text to an outfit slot. Parts are scanned in argument order,
 * so callers pass the most authoritative signal first (category, then
 * subcategory, then item name).
 */
export function resolveOutfitSlot(
  ...parts: Array<string | null | undefined>
): SlotResolution {
  const cleaned = parts
    .map((part) => normalizeSlotText(part ?? ""))
    .filter(Boolean);

  for (const part of cleaned) {
    const slot = exactLookup(part);
    if (slot) return { slot, source: "exact" };
  }

  const haystack = cleaned.join(" ");
  if (haystack) {
    for (const definition of OUTFIT_SLOT_DEFINITIONS) {
      if (definition.categoryKeywords.some((keyword) => haystack.includes(keyword))) {
        return { slot: definition.slot, source: "keyword" };
      }
    }
  }

  return { slot: "accessory", source: "fallback" };
}
