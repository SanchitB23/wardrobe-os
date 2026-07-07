/**
 * EXAMPLE prompt builder — reference implementation showing the pattern.
 *
 * It is intentionally generic (reads free-form `data` off the context) so it
 * compiles without depending on any domain type. Real builders should type
 * their own `PromptContext` subtype and import the relevant domain shapes.
 */

import { createPromptBuilder, withSchemaInstructions } from "@/ai/prompt-builders/prompt-builder";
import { objectSchema } from "@/ai/schemas";
import type { PromptBuilder, PromptContext, ResponseSchema } from "@/ai/types";

export interface OutfitSuggestion {
  title: string;
  itemIds: string[];
  rationale: string;
}

/** Schema the model output is validated against for outfit suggestions. */
export const outfitSuggestionSchema: ResponseSchema<OutfitSuggestion> =
  objectSchema<OutfitSuggestion>({
    name: "OutfitSuggestion",
    description: "an outfit suggestion",
    jsonHint: '{"title":"Smart casual","itemIds":["a","b"],"rationale":"…"}',
    fields: {
      title: { type: "string" },
      itemIds: { type: "array" },
      rationale: { type: "string" },
    },
  });

export interface OutfitPromptContext extends PromptContext {
  task: "outfit-suggestion";
}

export const outfitSuggestionPromptBuilder: PromptBuilder<OutfitPromptContext> =
  createPromptBuilder<OutfitPromptContext>({
    id: "outfit-suggestion",
    schema: outfitSuggestionSchema,
    render(context) {
      return {
        system:
          "You are a personal stylist. Suggest one cohesive outfit from the wardrobe provided.",
        prompt: [
          context.now ? `Date: ${context.now}` : undefined,
          `Context: ${JSON.stringify(context.data)}`,
          "Suggest one outfit.",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    },
  });

// Re-export so callers composing prompts by hand can reuse the helper.
export { withSchemaInstructions };
