/**
 * A small JSON Schema subset + validator for tool argument schemas. Pure and
 * dependency-free so it is provider-neutral and bundle-safe.
 *
 * This is intentionally minimal — enough to describe tool parameters (objects
 * of primitives/enums/arrays) and validate what a model passes back, mapping
 * cleanly onto Gemini's function-declaration schema and OpenAI's tool
 * parameters (both accept an OpenAPI/JSON-Schema subset).
 */

export type JSONSchemaType =
  | "object"
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array";

export interface JSONSchema {
  type: JSONSchemaType;
  description?: string;
  /** For type: "object". */
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean;
  /** For type: "array". */
  items?: JSONSchema;
  /** Restrict to a fixed set of values (primitive schemas). */
  enum?: readonly (string | number)[];
}

export type SchemaValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

function typeMatches(value: unknown, type: JSONSchemaType): boolean {
  switch (type) {
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
  }
}

/** Validate a value against a {@link JSONSchema}. Collects all errors. */
export function validateAgainstSchema(
  value: unknown,
  schema: JSONSchema,
  path = "",
): SchemaValidation {
  const errors: string[] = [];
  const at = path || "(root)";

  if (!typeMatches(value, schema.type)) {
    return { valid: false, errors: [`${at}: expected ${schema.type}`] };
  }

  if (schema.enum && !schema.enum.includes(value as string | number)) {
    errors.push(`${at}: must be one of ${schema.enum.join(", ")}`);
  }

  if (schema.type === "object") {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (record[key] === undefined || record[key] === null) {
        errors.push(`${path ? `${path}.` : ""}${key}: required`);
      }
    }
    const props = schema.properties ?? {};
    for (const [key, child] of Object.entries(props)) {
      if (record[key] === undefined) continue; // optional-by-default
      const result = validateAgainstSchema(
        record[key],
        child,
        `${path ? `${path}.` : ""}${key}`,
      );
      if (!result.valid) errors.push(...result.errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!(key in props)) errors.push(`${path ? `${path}.` : ""}${key}: unexpected property`);
      }
    }
  }

  if (schema.type === "array" && schema.items) {
    (value as unknown[]).forEach((item, i) => {
      const result = validateAgainstSchema(item, schema.items!, `${at}[${i}]`);
      if (!result.valid) errors.push(...result.errors);
    });
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

/** Convenience: an object schema with no required fields. */
export function objectParams(
  properties: Record<string, JSONSchema>,
  options: { required?: string[]; description?: string } = {},
): JSONSchema {
  return {
    type: "object",
    description: options.description,
    properties,
    required: options.required ?? [],
    additionalProperties: false,
  };
}
