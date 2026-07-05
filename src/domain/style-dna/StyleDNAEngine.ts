/**
 * Style DNA Engine — derives a deterministic {@link StyleDNA} profile from a
 * wardrobe item's existing metadata.
 *
 * Pure TypeScript: no React, no Supabase, no AI, no schema changes. Every item
 * is analyzable; unknown fields fall back to neutral defaults. The per-occasion
 * suitability scores encode the same "what fits what" knowledge the
 * recommendation engine relies on for eligibility.
 */

import {
  OUTFIT_SLOT_DEFINITIONS,
  categoryMatchesOutfitSlot,
} from "@/domain/outfit";
import type { FormalityEnum, OutfitSlot } from "@/types/wardrobe";
import type {
  ColorProfile,
  ColorTemperature,
  CompatibilityProfile,
  FabricWeight,
  OccasionKey,
  OccasionProfile,
  SeasonKey,
  StyleDNA,
  StyleDNAEngine,
  StyleDNAItem,
  StyleProfile,
  TextureFamily,
  TextureProfile,
  WeatherProfile,
} from "@/domain/style-dna/StyleDNA";

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
function clamp0To10(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

const FORMALITY_RANK: Record<FormalityEnum, number> = {
  casual: 0,
  smart_casual: 1,
  business_casual: 2,
  business_formal: 3,
  formal: 4,
};

const SEASON_KEYS: SeasonKey[] = ["summer", "monsoon", "autumn", "winter", "spring"];
const OCCASION_KEYS: OccasionKey[] = [
  "office",
  "smartCasual",
  "gym",
  "wedding",
  "travel",
  "social",
  "home",
  "casual",
];

function resolveSlot(item: StyleDNAItem): OutfitSlot {
  const haystack = `${item.category ?? ""} ${item.subcategory ?? ""}`;
  for (const definition of OUTFIT_SLOT_DEFINITIONS) {
    if (
      categoryMatchesOutfitSlot(item.category, definition.slot) ||
      categoryMatchesOutfitSlot(haystack, definition.slot)
    ) {
      return definition.slot;
    }
  }
  return "accessory";
}

function hay(item: StyleDNAItem): string {
  return normalize(`${item.name} ${item.subcategory ?? ""} ${item.category ?? ""} ${item.material ?? ""}`);
}
function tagStyleSet(item: StyleDNAItem): Set<string> {
  return new Set([...(item.tags ?? []), ...(item.styles ?? [])].map(normalize));
}
function hasKw(item: StyleDNAItem, keywords: readonly string[]): boolean {
  const h = hay(item);
  return keywords.some((k) => h.includes(k));
}
function hasAny(set: Set<string>, values: readonly string[]): boolean {
  return values.some((v) => set.has(v));
}

const KW = {
  tshirt: ["t-shirt", "tshirt", "tee"],
  activeTop: ["tank", "jersey", "active", "performance", "compression"],
  polo: ["polo"],
  chino: ["chino"],
  trouser: ["trouser", "slack", "dress pant"],
  jeans: ["jean", "denim"],
  shorts: ["short"],
  jogger: ["jogger", "sweatpant", "track pant", "trackpant", "track suit"],
  blazer: ["blazer"],
  tux: ["tuxedo", "tux"],
  suit: ["suit"],
  pajama: ["pajama", "pyjama", "lounge", "sleep"],
  dressShoe: ["oxford", "derby", "brogue", "loafer", "monk", "dress shoe", "formal shoe"],
  athleticShoe: ["running", "trainer", "training", "court", "tennis", "basketball", "cleat"],
  sneaker: ["sneaker", "plimsoll", "canvas", "574", "air force", "af1"],
  sandal: ["sandal", "slide", "flip"],
} as const;

const GYM_SIGNALS = ["gym", "athleisure", "performance", "sport", "sports", "active", "running", "training"];
const SMART_STYLES = ["smart casual", "business casual", "minimal", "classic", "modern"];
const CASUAL_STYLES = ["everyday casual", "casual", "streetwear", "athleisure"];

function hasGymSignal(item: StyleDNAItem): boolean {
  return hasAny(tagStyleSet(item), GYM_SIGNALS);
}
function isSmartCasualEnough(item: StyleDNAItem): boolean {
  return (
    item.formality === "smart_casual" ||
    item.formality === "business_casual" ||
    hasAny(tagStyleSet(item), SMART_STYLES)
  );
}
function isTshirt(item: StyleDNAItem): boolean {
  return hasKw(item, KW.tshirt);
}
function formalityRank(item: StyleDNAItem): number {
  return item.formality ? FORMALITY_RANK[item.formality] : 1; // default smart-casual-ish
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

type ColorMeta = { temperature: ColorTemperature; lightness: number; boldness: number };

const COLOR_FAMILIES: { family: string; keywords: string[]; meta: ColorMeta }[] = [
  { family: "white", keywords: ["white", "cream", "ivory", "off-white", "ecru"], meta: { temperature: "neutral", lightness: 0.95, boldness: 1 } },
  { family: "black", keywords: ["black", "jet"], meta: { temperature: "neutral", lightness: 0.06, boldness: 3 } },
  { family: "grey", keywords: ["charcoal", "grey", "gray", "slate", "graphite"], meta: { temperature: "neutral", lightness: 0.5, boldness: 1 } },
  { family: "navy", keywords: ["navy"], meta: { temperature: "cool", lightness: 0.2, boldness: 3 } },
  { family: "blue", keywords: ["blue", "teal", "indigo", "denim"], meta: { temperature: "cool", lightness: 0.45, boldness: 5 } },
  { family: "green", keywords: ["sage", "olive", "green", "mint", "emerald"], meta: { temperature: "cool", lightness: 0.45, boldness: 5 } },
  { family: "brown", keywords: ["beige", "tan", "khaki", "brown", "camel", "taupe", "sand", "stone", "chocolate"], meta: { temperature: "warm", lightness: 0.6, boldness: 2 } },
  { family: "red", keywords: ["red", "maroon", "burgundy", "wine", "rust"], meta: { temperature: "warm", lightness: 0.4, boldness: 8 } },
  { family: "pink", keywords: ["pink", "rose", "blush"], meta: { temperature: "warm", lightness: 0.75, boldness: 6 } },
  { family: "purple", keywords: ["purple", "lavender", "violet"], meta: { temperature: "cool", lightness: 0.45, boldness: 6 } },
  { family: "yellow", keywords: ["yellow", "mustard", "gold"], meta: { temperature: "warm", lightness: 0.82, boldness: 8 } },
  { family: "orange", keywords: ["orange", "coral", "peach"], meta: { temperature: "warm", lightness: 0.65, boldness: 8 } },
];

const NEUTRAL_FAMILIES = new Set(["white", "black", "grey", "navy", "brown"]);

function colorProfile(item: StyleDNAItem): ColorProfile {
  const name = item.color ?? null;
  const c = normalize(name);
  let match = item.colorFamily
    ? COLOR_FAMILIES.find((entry) => entry.family === normalize(item.colorFamily))
    : undefined;
  if (!match && c && c !== "not specified") {
    match = COLOR_FAMILIES.find((entry) => entry.keywords.some((k) => c.includes(k)));
  }
  const family = match?.family ?? (item.colorFamily ?? null);
  const meta = match?.meta ?? { temperature: "neutral" as ColorTemperature, lightness: 0.5, boldness: 3 };
  const contrast = clamp0To10(Math.abs(meta.lightness - 0.5) * 2 * 10);
  return {
    colorName: name,
    family,
    temperature: meta.temperature,
    lightness: meta.lightness,
    contrast,
    boldness: clamp0To10(meta.boldness),
    neutral: family ? NEUTRAL_FAMILIES.has(family) : false,
  };
}

// ---------------------------------------------------------------------------
// Texture / fabric
// ---------------------------------------------------------------------------

function textureProfile(item: StyleDNAItem): TextureProfile {
  const h = hay(item);
  const slot = resolveSlot(item);

  let texture: TextureFamily = "smooth";
  if (["denim", "jean"].some((k) => h.includes(k))) texture = "denim";
  else if (["leather", "suede"].some((k) => h.includes(k))) texture = "leather";
  else if (["wool", "knit", "sweater", "cashmere", "merino", "cable"].some((k) => h.includes(k))) texture = "knit";
  else if (["polyester", "nylon", "performance", "active", "tech", "spandex", "gore"].some((k) => h.includes(k))) texture = "technical";
  else if (["corduroy", "tweed", "linen", "cable"].some((k) => h.includes(k))) texture = "textured";
  else if (["cotton", "poplin", "oxford", "twill"].some((k) => h.includes(k))) texture = "smooth";

  let fabricWeight: FabricWeight = "medium";
  const heavy = ["wool", "coat", "denim", "leather", "tweed", "fleece", "puffer", "overcoat"].some((k) => h.includes(k)) || slot === "outerwear";
  const light = ["linen", "tee", "t-shirt", "tshirt", "shorts", "performance", "poplin", "silk"].some((k) => h.includes(k));
  if (heavy && !light) fabricWeight = "heavy";
  else if (light && !heavy) fabricWeight = "light";

  const fabricWeightScore = fabricWeight === "heavy" ? 9 : fabricWeight === "light" ? 3 : 6;

  const delicate = ["wool", "linen", "leather", "suede", "silk", "cashmere"].some((k) => h.includes(k));
  const easy = ["cotton", "polyester", "nylon", "performance", "denim", "poplin"].some((k) => h.includes(k));
  const careComplexity = delicate ? "delicate" : easy ? "easy" : "moderate";
  const careComplexityScore = careComplexity === "delicate" ? 8 : careComplexity === "easy" ? 2 : 5;

  return { texture, fabricWeight, fabricWeightScore, careComplexity, careComplexityScore };
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

const SEASON_TAG_ALIASES: Record<SeasonKey, string[]> = {
  summer: ["summer"],
  monsoon: ["monsoon", "rain", "rainy"],
  autumn: ["autumn", "fall"],
  winter: ["winter"],
  spring: ["spring"],
};

function weatherProfile(item: StyleDNAItem, weight: FabricWeight): WeatherProfile {
  const seasons = new Set((item.seasons ?? []).map(normalize));
  const yearRound = seasons.has("year round") || seasons.has("all season");

  const suitability = {} as Record<SeasonKey, number>;
  for (const season of SEASON_KEYS) {
    const tagged = SEASON_TAG_ALIASES[season].some((alias) => seasons.has(alias));
    let base = tagged ? 9 : yearRound ? 7 : 4;
    if (season === "summer" || season === "monsoon") {
      base += weight === "light" ? 2 : weight === "heavy" ? -3 : 0;
    } else if (season === "winter") {
      base += weight === "heavy" ? 2 : weight === "light" ? -3 : 0;
    } else {
      base += weight === "medium" ? 1 : 0;
    }
    suitability[season] = clamp0To10(base);
  }

  const minTempC = weight === "heavy" ? -5 : weight === "light" ? 20 : 8;
  const maxTempC = weight === "heavy" ? 22 : weight === "light" ? 45 : 33;
  return { suitability, minTempC, maxTempC };
}

// ---------------------------------------------------------------------------
// Occasion verdicts (encode the recommendation-eligibility knowledge)
// ---------------------------------------------------------------------------

type Verdict = "allowed" | "disallowed" | "optional";
const OPTIONAL_SLOTS = new Set<OutfitSlot>(["fragrance", "accessory", "watch", "belt"]);

function gymVerdict(item: StyleDNAItem, slot: OutfitSlot): Verdict {
  if (OPTIONAL_SLOTS.has(slot)) return "optional";
  const gym = hasGymSignal(item);
  if (slot === "footwear") {
    if (hasKw(item, KW.athleticShoe) || gym) return "allowed";
    if (hasKw(item, KW.dressShoe) || hasKw(item, KW.sandal)) return "disallowed";
    if (hasKw(item, KW.sneaker)) return "allowed";
    return "disallowed";
  }
  if (slot === "top") return hasKw(item, KW.activeTop) || gym ? "allowed" : "disallowed";
  if (slot === "bottom") return hasKw(item, KW.shorts) || hasKw(item, KW.jogger) || gym ? "allowed" : "disallowed";
  return gym ? "allowed" : "disallowed";
}

function officeVerdict(item: StyleDNAItem, slot: OutfitSlot): Verdict {
  if (OPTIONAL_SLOTS.has(slot)) return "optional";
  if (hasKw(item, KW.pajama)) return "disallowed";
  if (slot === "footwear") {
    if (hasKw(item, KW.dressShoe) || hasKw(item, KW.sneaker)) return "allowed";
    if (hasKw(item, KW.athleticShoe) && !isSmartCasualEnough(item)) return "disallowed";
    if (hasKw(item, KW.sandal)) return "disallowed";
    return "allowed";
  }
  if (slot === "top") {
    if (hasKw(item, KW.activeTop) || (hasGymSignal(item) && !isSmartCasualEnough(item))) return "disallowed";
    if (isTshirt(item)) return isSmartCasualEnough(item) ? "allowed" : "disallowed";
    return "allowed";
  }
  if (slot === "bottom") {
    if (hasKw(item, KW.shorts) || hasKw(item, KW.jogger) || hasGymSignal(item)) return "disallowed";
    if (hasKw(item, KW.jeans)) return isSmartCasualEnough(item) ? "allowed" : "disallowed";
    return "allowed";
  }
  if (slot === "outerwear") return hasKw(item, KW.tux) ? "disallowed" : "allowed";
  return "optional";
}

function weddingVerdict(item: StyleDNAItem, slot: OutfitSlot): Verdict {
  if (OPTIONAL_SLOTS.has(slot)) return "optional";
  if (slot === "footwear") return hasKw(item, KW.dressShoe) ? "allowed" : "disallowed";
  const dressy = formalityRank(item) >= FORMALITY_RANK.business_formal;
  if (slot === "top") {
    if (isTshirt(item) || hasKw(item, KW.polo) || hasKw(item, KW.activeTop)) return "disallowed";
    return dressy || hasKw(item, ["shirt"]) ? "allowed" : "disallowed";
  }
  if (slot === "bottom") return hasKw(item, KW.trouser) || dressy ? "allowed" : "disallowed";
  if (slot === "outerwear")
    return hasKw(item, KW.blazer) || hasKw(item, KW.tux) || hasKw(item, KW.suit) ? "allowed" : "disallowed";
  return "optional";
}

function verdictScore(verdict: Verdict): number {
  return verdict === "allowed" ? 9 : verdict === "optional" ? 5 : 0;
}

function occasionProfile(item: StyleDNAItem, slot: OutfitSlot): OccasionProfile {
  const set = tagStyleSet(item);
  const rank = formalityRank(item);
  const gym = hasGymSignal(item);
  const activewear = hasKw(item, KW.activeTop) || gym || hasKw(item, KW.jogger) || hasKw(item, KW.athleticShoe);

  // smartCasual
  let smartCasual: number;
  if (isSmartCasualEnough(item)) smartCasual = 8;
  else if (rank >= FORMALITY_RANK.business_formal) smartCasual = 4;
  else if (activewear) smartCasual = 1;
  else smartCasual = 6;

  // casual / home
  const casualStyle = hasAny(set, CASUAL_STYLES);
  const casual = rank <= FORMALITY_RANK.smart_casual ? (casualStyle ? 9 : 7) : rank >= FORMALITY_RANK.business_formal ? 3 : 5;
  const home = OPTIONAL_SLOTS.has(slot)
    ? 5
    : rank <= FORMALITY_RANK.smart_casual
      ? hasKw(item, KW.pajama) || casualStyle
        ? 8
        : 6
      : 2;

  // social (dinner/date/brewery)
  const socialTag = hasAny(set, ["dinner", "date", "brewery", "party", "brunch"]);
  let social: number;
  if (activewear) social = 1;
  else if (socialTag || (rank >= FORMALITY_RANK.smart_casual && rank <= FORMALITY_RANK.business_formal)) social = 8;
  else social = 5;

  // travel: comfort + low care + not-too-formal
  const texture = textureProfile(item);
  let travel = 6;
  travel += rank <= FORMALITY_RANK.smart_casual ? 2 : rank >= FORMALITY_RANK.formal ? -3 : 0;
  travel += texture.careComplexity === "easy" ? 1 : texture.careComplexity === "delicate" ? -2 : 0;
  if (hasAny(set, ["travel", "vacation"])) travel += 1;

  const suitability: Record<OccasionKey, number> = {
    office: verdictScore(officeVerdict(item, slot)),
    smartCasual: clamp0To10(smartCasual),
    gym: verdictScore(gymVerdict(item, slot)),
    wedding: verdictScore(weddingVerdict(item, slot)),
    travel: clamp0To10(travel),
    social: clamp0To10(social),
    home: clamp0To10(home),
    casual: clamp0To10(casual),
  };

  let best: OccasionKey = OCCASION_KEYS[0];
  for (const key of OCCASION_KEYS) {
    if (suitability[key] > suitability[best]) best = key;
  }
  return { suitability, best };
}

// ---------------------------------------------------------------------------
// Style + compatibility
// ---------------------------------------------------------------------------

const FORMALITY_STYLE_LABEL: Record<FormalityEnum, string> = {
  casual: "Casual",
  smart_casual: "Smart Casual",
  business_casual: "Business Casual",
  business_formal: "Business Formal",
  formal: "Formal",
};

function styleProfile(item: StyleDNAItem): StyleProfile {
  const styles = (item.styles ?? []).filter((s) => s.trim());
  const primary = styles[0] ?? (item.formality ? FORMALITY_STYLE_LABEL[item.formality] : null);
  const secondary = styles[1] ?? null;
  const formalityScore = clamp0To10((formalityRank(item) / 4) * 10);

  const set = tagStyleSet(item);
  let professionalism = formalityScore;
  if (hasAny(set, ["office", "leadership", "business casual", "classic", "formal"])) professionalism += 2;
  if (hasAny(set, ["athleisure", "streetwear", "gym", "sport"])) professionalism -= 4;
  if (hasKw(item, KW.pajama) || hasKw(item, KW.shorts)) professionalism -= 3;

  return {
    primary,
    secondary,
    formality: item.formality ?? null,
    formalityScore,
    professionalism: clamp0To10(professionalism),
  };
}

function compatibilityProfile(
  item: StyleDNAItem,
  slot: OutfitSlot,
  color: ColorProfile,
  texture: TextureProfile,
  occasion: OccasionProfile,
): CompatibilityProfile {
  const suited = OCCASION_KEYS.filter((key) => occasion.suitability[key] >= 6).length;
  let versatility = suited * 1.2;
  if (color.neutral) versatility += 2;
  if (item.formality === "smart_casual" || item.formality === "business_casual") versatility += 1.5;

  let travel = 5;
  travel += texture.careComplexity === "easy" ? 2 : texture.careComplexity === "delicate" ? -2 : 0;
  travel += texture.fabricWeight === "heavy" ? -1 : 1;
  if (slot === "footwear") travel += hasKw(item, KW.sneaker) || hasKw(item, KW.athleticShoe) ? 1 : hasKw(item, KW.dressShoe) ? -2 : 0;
  // Fragile: light-coloured or suede footwear is risky to travel in.
  if (slot === "footwear" && (texture.texture === "leather" || color.lightness > 0.7)) travel -= 2;
  travel += color.neutral ? 1 : 0;

  let commute = 6;
  const rank = formalityRank(item);
  commute += rank <= FORMALITY_RANK.business_casual ? 1.5 : -1.5;
  commute += texture.careComplexity === "delicate" ? -1 : 0;
  if (slot === "footwear") commute += hasKw(item, KW.sneaker) ? 1.5 : hasKw(item, KW.dressShoe) ? -0.5 : 0;

  const visualBoldness = clamp0To10(
    color.boldness * 0.6 + color.contrast * 0.3 + (hasAny(tagStyleSet(item), ["statement", "streetwear"]) ? 3 : 0),
  );

  return {
    versatility: clamp0To10(versatility),
    travelFriendliness: clamp0To10(travel),
    commuteFriendliness: clamp0To10(commute),
    visualBoldness,
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/** Derives the full {@link StyleDNA} for a single item. Deterministic. */
export function deriveStyleDNA(item: StyleDNAItem): StyleDNA {
  const slot = resolveSlot(item);
  const color = colorProfile(item);
  const texture = textureProfile(item);
  const weather = weatherProfile(item, texture.fabricWeight);
  const occasion = occasionProfile(item, slot);
  const style = styleProfile(item);
  const compatibility = compatibilityProfile(item, slot, color, texture, occasion);

  return {
    itemId: item.id,
    name: item.name,
    slot,
    formality: item.formality ?? null,
    primaryStyle: style.primary,
    secondaryStyle: style.secondary,
    color,
    texture,
    weather,
    occasion,
    style,
    compatibility,
  };
}

/** The default {@link StyleDNAEngine} implementation. */
export const styleDNAEngine: StyleDNAEngine = {
  analyze: (item) => deriveStyleDNA(item),
  analyzeAll: (items) => items.map(deriveStyleDNA),
};

/** Factory for a fresh engine instance (stateless; returns the default). */
export function createStyleDNAEngine(): StyleDNAEngine {
  return styleDNAEngine;
}
