/**
 * Deterministic occasion suggestions (RFC-026, Option D + keyword match).
 * Emits canonical concepts from formality/tags/styles/category, then matches
 * concepts to the user's personal occasion lookup via synonym tokens.
 * Pure — no I/O, no AI. Suggestions only pre-fill UI; the user confirms.
 */

export type OccasionConcept = {
  concept: string;
  reason: string;
};

export type SuggestOccasionsInput = {
  formality: string | null;
  tags: readonly string[];
  styles: readonly string[];
  categoryName: string | null;
};

const FORMALITY_CONCEPTS: Record<string, string[]> = {
  casual: ["home"],
  smart_casual: ["office"],
  business_casual: ["office"],
  business: ["office"],
  formal: ["office", "wedding"],
};

/** Signal keyword → concept (matched against tag/style/category tokens). */
const SIGNAL_CONCEPTS: Record<string, string> = {
  gym: "gym",
  athleisure: "gym",
  activewear: "gym",
  workout: "gym",
  sport: "gym",
  travel: "travel",
  vacation: "travel",
  lounge: "home",
  sleep: "home",
  sleepwear: "home",
  pajama: "home",
  home: "home",
  office: "office",
  work: "office",
  wedding: "wedding",
  festive: "wedding",
};

/** Concept → synonym tokens matched against occasion lookup names. */
const CONCEPT_SYNONYMS: Record<string, string[]> = {
  office: ["office", "work", "client", "interview", "meeting"],
  home: ["home", "wfh", "lounge"],
  gym: ["gym", "workout", "training"],
  travel: ["travel", "airport", "vacation", "trip"],
  wedding: ["wedding", "reception"],
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function suggestOccasionConcepts(
  input: SuggestOccasionsInput,
): OccasionConcept[] {
  const seen = new Set<string>();
  const concepts: OccasionConcept[] = [];

  function add(concept: string, reason: string) {
    if (seen.has(concept)) return;
    seen.add(concept);
    concepts.push({ concept, reason });
  }

  if (input.formality) {
    for (const concept of FORMALITY_CONCEPTS[normalize(input.formality)] ?? []) {
      add(concept, `formality:${input.formality}`);
    }
  }

  const signals: Array<{ value: string; source: string }> = [
    ...input.tags.map((tag) => ({ value: tag, source: `tag:${tag}` })),
    ...input.styles.map((style) => ({ value: style, source: `style:${style}` })),
    ...(input.categoryName
      ? [{ value: input.categoryName, source: `category:${input.categoryName}` }]
      : []),
  ];

  for (const signal of signals) {
    const haystack = normalize(signal.value);
    for (const [keyword, concept] of Object.entries(SIGNAL_CONCEPTS)) {
      if (haystack.includes(keyword)) {
        add(concept, signal.source);
      }
    }
  }

  return concepts;
}

export function matchOccasionsToConcepts(
  concepts: readonly OccasionConcept[],
  occasions: readonly { id: string; name: string }[],
): { id: string; name: string; reason: string }[] {
  const matches = new Map<string, { id: string; name: string; reason: string }>();

  for (const concept of concepts) {
    const synonyms = CONCEPT_SYNONYMS[concept.concept] ?? [concept.concept];
    for (const occasion of occasions) {
      if (matches.has(occasion.id)) continue;
      const name = normalize(occasion.name);
      if (synonyms.some((synonym) => name.includes(synonym))) {
        matches.set(occasion.id, {
          id: occasion.id,
          name: occasion.name,
          reason: concept.reason,
        });
      }
    }
  }

  return [...matches.values()];
}
