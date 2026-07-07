/**
 * Prompt building (requirement 4). Pure and provider-independent: a builder
 * turns a {@link PromptContext} into a {@link BuiltPrompt}; the orchestrator is
 * responsible for wrapping that into an {@link AIRequest} for a chosen provider.
 * Nothing here imports a provider or an SDK.
 *
 * EXTENSION POINT: add a new builder per task (e.g. outfit suggestions, item
 * tagging, capsule planning) via {@link createPromptBuilder}. Attach a
 * ResponseSchema so structured output is validated downstream.
 */

import type {
  BuiltPrompt,
  PromptBuilder,
  PromptContext,
  ResponseSchema,
} from "@/ai/types";

/**
 * Append a schema's JSON hint (and a generic instruction) to a prompt so the
 * model is nudged toward valid structured output. Independent of any provider.
 */
export function withSchemaInstructions(
  prompt: string,
  schema?: ResponseSchema,
): string {
  if (!schema) return prompt;
  const lines = [
    prompt,
    "",
    "Respond with a single valid JSON value and nothing else — no prose, no code fences.",
  ];
  if (schema.description) lines.push(`Shape: ${schema.description}`);
  if (schema.jsonHint) lines.push(`Example:\n${schema.jsonHint}`);
  return lines.join("\n");
}

/**
 * Create a {@link PromptBuilder} from a render function. The render function
 * gets the context and returns the system/user text; if a schema is provided,
 * its instructions are appended to the user prompt automatically.
 */
export function createPromptBuilder<C extends PromptContext = PromptContext>(spec: {
  id: string;
  schema?: ResponseSchema;
  render: (context: C) => { system?: string; prompt: string };
}): PromptBuilder<C> {
  return {
    id: spec.id,
    build(context: C): BuiltPrompt {
      const { system, prompt } = spec.render(context);
      return {
        system,
        prompt: withSchemaInstructions(prompt, spec.schema),
        schema: spec.schema,
      };
    },
  };
}
