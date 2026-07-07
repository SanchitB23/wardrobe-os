/**
 * ShoppingImageInterpreter (RFC-003) — pure, deterministic mapping from a
 * {@link VisionAnalysis} to a user-editable {@link ProspectiveItemCandidate}.
 *
 * Vision observes, the interpreter maps, the engine decides. This layer makes
 * NO decisions and calls no AI — it selects the primary detected product,
 * translates its StyleDNACandidate into ProspectiveItem fields, records per-field
 * confidence, and lists alternatives for multi-product images. Price is never
 * extracted (RFC-003 non-goal) — the user supplies it.
 */

import type { ProspectiveItem } from "@/domain/acquisition/types";
import type {
  ProspectiveFieldConfidence,
  ProspectiveItemCandidate,
} from "@/domain/acquisition/types";
import type { DetectedItem, VisionAnalysis } from "@/domain/vision";

/** Fields at/below this confidence are flagged for the user to double-check. */
const LOW_FIELD_CONFIDENCE = 0.6;

/** Map one detected item to a ProspectiveItem (price intentionally null). */
function toProspectiveItem(detected: DetectedItem): ProspectiveItem {
  const dna = detected.styleDNACandidate;
  const primaryColor = detected.colors[0] ?? null;
  return {
    name: detected.label || dna.name || detected.category || "Detected item",
    category: detected.category ?? dna.category ?? "",
    subcategory: dna.subcategory ?? null,
    brand: detected.brandGuess ?? dna.brandGuess ?? null,
    color: primaryColor?.name ?? dna.color ?? null,
    estimatedPrice: null, // vision does not extract price (RFC-003 non-goal)
    material: detected.material ?? dna.material ?? null,
    styleTags: dna.styleTags ?? [],
    formality: dna.formality ?? null,
    intendedOccasions: [],
    productUrl: null,
    notes: null,
  };
}

/** Per-field confidence: fields the model actually filled inherit item conf. */
function fieldConfidenceFor(
  detected: DetectedItem,
  item: ProspectiveItem,
): ProspectiveFieldConfidence {
  const c = detected.confidence;
  const conf: ProspectiveFieldConfidence = {};
  if (item.name) conf.name = c;
  if (item.category) conf.category = c;
  if (item.subcategory) conf.subcategory = c;
  // Brand from vision is always low-confidence (RFC-002 policy).
  if (item.brand) conf.brand = Math.min(c, 0.4);
  if (item.color) conf.color = detected.colors[0]?.confidence ?? c;
  if (item.material) conf.material = c;
  if (item.formality) conf.formality = Math.min(c, 0.55);
  return conf;
}

export interface InterpretOptions {
  /** Which detected item to treat as primary (default: 0 = highest confidence). */
  preferItemIndex?: number;
}

export function interpretShoppingImage(
  analysis: VisionAnalysis,
  options: InterpretOptions = {},
): ProspectiveItemCandidate {
  // detectedItems are already sorted by confidence (VisionNormalizer).
  const items = analysis.detectedItems;
  const index = clampIndex(options.preferItemIndex ?? 0, items.length);
  const primary = items[index] ?? null;

  const provenance = {
    imageHash: analysis.metadata.imageHash,
    visionProvider: analysis.metadata.provider,
    visionModel: analysis.metadata.model,
    sourceType: String(analysis.sourceType),
  };

  if (!primary) {
    // Nothing detected → an empty, fully-editable candidate.
    return {
      item: {
        name: "",
        category: "",
        subcategory: null,
        brand: null,
        color: null,
        estimatedPrice: null,
        material: null,
        styleTags: [],
        formality: null,
        intendedOccasions: [],
        productUrl: null,
        notes: null,
      },
      confidence: analysis.confidence,
      quality: analysis.quality,
      lowConfidenceFields: [],
      fieldConfidence: {},
      alternatives: [],
      provenance,
    };
  }

  const item = toProspectiveItem(primary);
  const fieldConfidence = fieldConfidenceFor(primary, item);
  const lowConfidenceFields = (Object.keys(fieldConfidence) as (keyof ProspectiveItem)[]).filter(
    (key) => (fieldConfidence[key] ?? 1) <= LOW_FIELD_CONFIDENCE,
  );

  const alternatives = items
    .filter((_, i) => i !== index)
    .map(toProspectiveItem);

  return {
    item,
    confidence: analysis.confidence,
    quality: analysis.quality,
    lowConfidenceFields,
    fieldConfidence,
    alternatives,
    provenance,
  };
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  if (!Number.isInteger(index) || index < 0) return 0;
  return Math.min(index, length - 1);
}
