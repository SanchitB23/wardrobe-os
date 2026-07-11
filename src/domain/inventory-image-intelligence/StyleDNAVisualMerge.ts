/**
 * StyleDNAVisualMerge (RFC-020) — pure.
 * Merge accepted VisualStyleAttributes into a StyleDNAItem.
 * Manual non-null fields always win; low confidence contributes nothing.
 */

import type { StyleDNAItem } from "@/domain/style-dna";
import type { FormalityEnum } from "@/types/wardrobe";
import {
  VISUAL_CONFIDENCE_THRESHOLD,
  type VisualStyleAttributes,
} from "@/domain/inventory-image-intelligence/types";

export interface StyleDNAMergeInput {
  manual: StyleDNAItem;
  visual: VisualStyleAttributes | null;
}

const FORMALITY_VALUES = new Set<string>([
  "casual",
  "smart_casual",
  "business_casual",
  "formal",
  "black_tie",
  "athletic",
  "loungewear",
]);

function asFormality(value: string | null): FormalityEnum | null {
  if (!value) return null;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (FORMALITY_VALUES.has(key)) return key as FormalityEnum;
  return null;
}

function present(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

/**
 * Apply accepted visual gap-fill / soft tags onto a StyleDNAItem.
 * Never mutates `manual` in place — returns a new object.
 */
export function mergeVisualIntoStyleDNAItem(
  input: StyleDNAMergeInput,
): StyleDNAItem {
  const { manual, visual } = input;
  if (!visual || visual.status !== "accepted") return { ...manual };
  if (visual.confidence < VISUAL_CONFIDENCE_THRESHOLD) return { ...manual };

  const primaryColor =
    visual.dominantColors[0]?.name ?? visual.dominantColors[0]?.family ?? null;
  const colorFamily = visual.dominantColors[0]?.family ?? null;

  const softTags: string[] = [];
  if (visual.pattern) softTags.push(`visual:pattern:${visual.pattern}`);
  if (visual.texture) softTags.push(`visual:texture:${visual.texture}`);
  if (visual.silhouette) softTags.push(`visual:silhouette:${visual.silhouette}`);
  for (const tag of visual.styleTags) {
    if (tag && !tag.startsWith("pattern:") && !tag.startsWith("texture:")) {
      softTags.push(tag);
    }
  }

  const mergedTags = [
    ...new Set([...(manual.tags ?? []), ...softTags].map((t) => t.trim()).filter(Boolean)),
  ];

  const formality =
    manual.formality ?? asFormality(visual.formalityGuess) ?? null;

  return {
    ...manual,
    color: present(manual.color) ? manual.color : primaryColor,
    colorFamily: present(manual.colorFamily)
      ? manual.colorFamily
      : colorFamily,
    material: present(manual.material) ? manual.material : visual.materialGuess,
    formality,
    tags: mergedTags,
    styles: manual.styles,
  };
}

/** Diff helpers for UI — which visual fields would fill gaps on Accept. */
export function visualManualDiff(
  manual: {
    color?: string | null;
    material?: string | null;
    formality?: string | null;
    tags?: readonly string[];
  },
  visual: VisualStyleAttributes | null,
): { field: string; manual: string | null; visual: string | null; fillsGap: boolean }[] {
  if (!visual) return [];
  const visualColor =
    visual.dominantColors[0]?.name ?? visual.dominantColors[0]?.family ?? null;
  return [
    {
      field: "color",
      manual: manual.color ?? null,
      visual: visualColor,
      fillsGap: !present(manual.color) && present(visualColor),
    },
    {
      field: "material",
      manual: manual.material ?? null,
      visual: visual.materialGuess,
      fillsGap: !present(manual.material) && present(visual.materialGuess),
    },
    {
      field: "formality",
      manual: manual.formality ?? null,
      visual: visual.formalityGuess,
      fillsGap: !present(manual.formality) && present(visual.formalityGuess),
    },
    {
      field: "pattern",
      manual: null,
      visual: visual.pattern,
      fillsGap: present(visual.pattern),
    },
    {
      field: "texture",
      manual: null,
      visual: visual.texture,
      fillsGap: present(visual.texture),
    },
    {
      field: "silhouette",
      manual: null,
      visual: visual.silhouette,
      fillsGap: present(visual.silhouette),
    },
  ];
}
