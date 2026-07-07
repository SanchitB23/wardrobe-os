/**
 * Structured-output helpers (requirement 5). Pure — no provider SDKs.
 *
 * A {@link ResponseSchema} is a name + validator (+ optional jsonHint that gets
 * appended to prompts). A {@link ResponseParser} extracts JSON from raw model
 * text and validates it against a schema.
 *
 * EXTENSION POINT: `validate` is intentionally hand-rolled so this layer stays
 * dependency-free. To adopt Zod/Valibot later, wrap the schema in
 * {@link defineResponseSchema} and delegate `validate` to `schema.safeParse`.
 */

import type {
  ParseResult,
  ResponseParser,
  ResponseSchema,
  ValidationResult,
} from "@/ai/types";

export const valid: ValidationResult = { valid: true };

export function invalid(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

/** Wrap a name + validator into a {@link ResponseSchema}. */
export function defineResponseSchema<T>(spec: {
  name: string;
  description?: string;
  jsonHint?: string;
  validate: (value: unknown) => ValidationResult;
}): ResponseSchema<T> {
  return {
    name: spec.name,
    description: spec.description,
    jsonHint: spec.jsonHint,
    validate: spec.validate,
  };
}

type FieldKind = "string" | "number" | "boolean" | "object" | "array";

interface FieldSpec {
  type: FieldKind;
  optional?: boolean;
}

/**
 * Minimal object-shape validator factory. Checks presence and primitive type of
 * top-level fields — enough to guard model output without a schema library.
 */
export function objectSchema<T>(spec: {
  name: string;
  description?: string;
  jsonHint?: string;
  fields: Record<string, FieldSpec>;
}): ResponseSchema<T> {
  const entries = Object.entries(spec.fields);
  return defineResponseSchema<T>({
    name: spec.name,
    description: spec.description,
    jsonHint: spec.jsonHint,
    validate(value) {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return invalid(`${spec.name}: expected an object`);
      }
      const record = value as Record<string, unknown>;
      const errors: string[] = [];
      for (const [key, field] of entries) {
        const present = key in record && record[key] !== undefined;
        if (!present) {
          if (!field.optional) errors.push(`${spec.name}.${key}: required`);
          continue;
        }
        if (!matchesKind(record[key], field.type)) {
          errors.push(
            `${spec.name}.${key}: expected ${field.type}, got ${describe(record[key])}`,
          );
        }
      }
      return errors.length ? { valid: false, errors } : valid;
    },
  });
}

function matchesKind(value: unknown, kind: FieldKind): boolean {
  switch (kind) {
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return typeof value === kind;
  }
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Pull the first JSON value out of raw model text. Handles bare JSON as well as
 * ```json fenced blocks and leading/trailing prose. Returns undefined if none.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [
    fenced?.[1]?.trim(),
    trimmed,
    sliceBalanced(trimmed, "{", "}"),
    sliceBalanced(trimmed, "[", "]"),
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

/** Extract the substring from the first `open` to its matching `close`. */
function sliceBalanced(text: string, open: string, close: string): string | undefined {
  const start = text.indexOf(open);
  if (start === -1) return undefined;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}

/** Build a {@link ResponseParser} that extracts JSON and validates it. */
export function createJsonResponseParser<T>(
  schema: ResponseSchema<T>,
): ResponseParser<T> {
  return {
    schema,
    parse(raw): ParseResult<T> {
      const value = extractJson(raw);
      if (value === undefined) {
        return { ok: false, errors: [`${schema.name}: no JSON found in response`] };
      }
      const result = schema.validate(value);
      if (!result.valid) {
        return { ok: false, errors: result.errors };
      }
      return { ok: true, data: value as T };
    },
  };
}
