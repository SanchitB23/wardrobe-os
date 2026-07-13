/**
 * VisionNormalizer (RFC-002) — pure, deterministic. Turns a provider's
 * {@link RawVisionResult} into the canonical {@link VisionAnalysis}: canonical
 * slots, colour families, per-item confidence, derived StyleDNACandidates,
 * aggregate cues, and the confidence→quality band. Then validates (drops junk /
 * below-threshold detections). No model calls, no I/O; `generatedAt` injected.
 */

import { resolveOutfitSlot } from "@/domain/outfit/slot-resolution";
import {
  buildStyleDNACandidate,
  type StyleDNACandidate,
} from "@/domain/vision/StyleDNACandidate";
import {
  aggregateConfidence,
  clamp01,
  qualityFromConfidence,
} from "@/domain/vision/VisionConfidence";
import { buildVisionMetadata } from "@/domain/vision/VisionMetadata";
import type {
  ColorObservation,
  DetectedItem,
  RawDetectedItem,
  RawVisionResult,
  Segmentation,
  VisionAnalysis,
  VisionImageInput,
} from "@/domain/vision/VisionAnalysis";

/** Detections below this confidence are dropped in Validate. */
const MIN_ITEM_CONFIDENCE = 0.2;

const COLOR_FAMILIES: [family: string, keywords: string[]][] = [
  ["blue", ["navy", "blue", "teal", "indigo", "cobalt"]],
  ["black", ["black", "charcoal black", "jet"]],
  ["white", ["white", "ivory", "cream", "off-white", "off white"]],
  ["grey", ["grey", "gray", "charcoal", "slate", "graphite"]],
  ["beige", ["beige", "tan", "khaki", "camel", "sand", "stone", "taupe"]],
  ["brown", ["brown", "chocolate", "coffee", "mocha"]],
  ["green", ["green", "olive", "sage", "forest", "mint"]],
  ["red", ["red", "maroon", "burgundy", "crimson", "wine"]],
  ["pink", ["pink", "rose", "blush", "salmon"]],
  ["purple", ["purple", "violet", "lavender", "plum"]],
  ["yellow", ["yellow", "mustard", "gold"]],
  ["orange", ["orange", "rust", "terracotta"]],
];

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim();
}

function slotFor(label: string, category: string | null): string | null {
  const resolution = resolveOutfitSlot(category, label);
  return resolution.source === "fallback" ? null : resolution.slot;
}

function colorFamilyFor(name: string | null): string | null {
  const n = normalize(name);
  if (!n) return null;
  for (const [family, keywords] of COLOR_FAMILIES) {
    if (keywords.some((k) => n.includes(k))) return family;
  }
  return null;
}

function toColorObservations(
  raw: RawDetectedItem["colors"],
  itemConfidence: number,
): ColorObservation[] {
  return (raw ?? [])
    .filter((c) => c && (c.name || c.hex))
    .map((c) => ({
      name: c.name ?? null,
      family: colorFamilyFor(c.name ?? null),
      hex: c.hex ?? null,
      coveragePct: typeof c.coveragePct === "number" ? c.coveragePct : null,
      confidence: itemConfidence,
    }));
}

function toSegmentation(raw: RawDetectedItem["boundingBox"]): Segmentation | null {
  if (!raw) return null;
  return { boundingBox: raw, polygon: null };
}

function toDetectedItem(raw: RawDetectedItem): DetectedItem | null {
  const label = normalize(raw.label) || normalize(raw.category);
  if (!label) return null; // Validate: drop label-less junk.
  const confidence = clamp01(raw.confidence ?? 0.5);
  const category = raw.category ?? raw.label ?? null;
  const slot = slotFor(raw.label ?? "", category);
  const colors = toColorObservations(raw.colors, confidence);
  const primaryColor = colors[0] ?? null;

  const candidate: StyleDNACandidate = buildStyleDNACandidate({
    name: raw.label ?? null,
    category,
    slot,
    color: primaryColor?.name ?? null,
    colorFamily: primaryColor?.family ?? null,
    material: raw.material ?? null,
    texture: raw.texture ?? null,
    pattern: raw.pattern ?? null,
    formality: raw.formality ?? null,
    styleTags: raw.styleTags ?? [],
    brandGuess: raw.brand ?? null,
    confidence,
  });

  return {
    label: raw.label ?? label,
    category,
    slot,
    colors,
    material: raw.material ?? null,
    texture: raw.texture ?? null,
    pattern: raw.pattern ?? null,
    brandGuess: raw.brand ?? null,
    segmentation: toSegmentation(raw.boundingBox),
    styleDNACandidate: candidate,
    confidence,
  };
}

/** Aggregate the most prominent colours across all detected items. */
function dominantColors(items: DetectedItem[]): ColorObservation[] {
  const byKey = new Map<string, ColorObservation>();
  for (const item of items) {
    for (const color of item.colors) {
      const key = normalize(color.family ?? color.name ?? "");
      if (!key) continue;
      const existing = byKey.get(key);
      if (!existing || color.confidence > existing.confidence) byKey.set(key, color);
    }
  }
  return [...byKey.values()]
    .sort((a, b) => (b.coveragePct ?? 0) - (a.coveragePct ?? 0) || b.confidence - a.confidence)
    .slice(0, 5);
}

function firstDefined(items: DetectedItem[], pick: (i: DetectedItem) => string | null): string | null {
  for (const item of items) {
    const value = pick(item);
    if (value) return value;
  }
  return null;
}

export function normalizeVision(
  raw: RawVisionResult,
  input: VisionImageInput,
  options: { generatedAt?: string; latencyMs?: number | null } = {},
): VisionAnalysis {
  // Normalize → Validate: map every raw item, then drop nulls + below-threshold.
  const detectedItems = (raw.items ?? [])
    .map(toDetectedItem)
    .filter((item): item is DetectedItem => item !== null && item.confidence >= MIN_ITEM_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence);

  const confidence = aggregateConfidence(detectedItems);
  const segmentation = detectedItems
    .map((item) => item.segmentation)
    .filter((s): s is Segmentation => s !== null);

  return {
    sourceType: input.source,
    detectedItems,
    dominantColors: dominantColors(detectedItems),
    material: firstDefined(detectedItems, (i) => i.material),
    texture: firstDefined(detectedItems, (i) => i.texture),
    pattern: firstDefined(detectedItems, (i) => i.pattern),
    brand: firstDefined(detectedItems, (i) => i.brandGuess),
    styleDNACandidates: detectedItems.map((item) => item.styleDNACandidate),
    confidence,
    quality: qualityFromConfidence(confidence),
    segmentation: segmentation.length > 0 ? segmentation : null,
    metadata: buildVisionMetadata({
      provider: raw.provider,
      model: raw.model,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      latencyMs: options.latencyMs ?? null,
      input,
    }),
  };
}
