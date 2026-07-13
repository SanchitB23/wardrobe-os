/**
 * Tolerant parser for a vision model's JSON garment output (RFC-029). Accepts
 * `{"items":[…]}` optionally wrapped in code fences or prose; returns [] on
 * failure. Shared by the Gemini and OpenAI vision providers. Pure.
 */

import type { RawDetectedItem } from "@/domain/vision";

export function parseVisionItems(text: string | null | undefined): RawDetectedItem[] {
  if (!text) return [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text, text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as { items?: RawDetectedItem[] };
      if (Array.isArray(parsed.items)) return parsed.items;
    } catch {
      // try next candidate
    }
  }
  return [];
}
