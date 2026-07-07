/**
 * StyleDNACandidate — a proposed, partial style profile derived from an image
 * (RFC-002). It maps toward `StyleDNAItem` so downstream engines can consume
 * vision output. It is a PROPOSAL with confidence — never authoritative; a
 * human or a deterministic engine confirms it. Pure types + builder.
 */

export interface StyleDNACandidate {
  name: string | null;
  category: string | null;
  subcategory: string | null;
  slot: string | null;
  color: string | null;
  colorFamily: string | null;
  material: string | null;
  texture: string | null;
  pattern: string | null;
  formality: string | null;
  styleTags: string[];
  brandGuess: string | null;
  /** 0–1 — how confident the extraction of this candidate is. */
  confidence: number;
}

export interface StyleDNACandidateInput {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  slot?: string | null;
  color?: string | null;
  colorFamily?: string | null;
  material?: string | null;
  texture?: string | null;
  pattern?: string | null;
  formality?: string | null;
  styleTags?: string[];
  brandGuess?: string | null;
  confidence?: number;
}

/** Build a normalized candidate with safe defaults. Pure. */
export function buildStyleDNACandidate(input: StyleDNACandidateInput): StyleDNACandidate {
  return {
    name: input.name ?? null,
    category: input.category ?? null,
    subcategory: input.subcategory ?? null,
    slot: input.slot ?? null,
    color: input.color ?? null,
    colorFamily: input.colorFamily ?? null,
    material: input.material ?? null,
    texture: input.texture ?? null,
    pattern: input.pattern ?? null,
    formality: input.formality ?? null,
    styleTags: input.styleTags ?? [],
    brandGuess: input.brandGuess ?? null,
    confidence: clamp01(input.confidence ?? 0),
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
