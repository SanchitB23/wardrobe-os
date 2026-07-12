/**
 * Server-side Buy vs Skip explanation (RFC-003). Runs the explanation prompt
 * through AIRuntime (capability: explanation, with cache), returning validated
 * prose. The AI only explains the deterministic verdict — it never decides.
 * Injectable runtime for tests.
 */

import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";
import type { AIRuntime } from "@/runtime/ai";
import type { BuyVsSkipAnalysis } from "@/domain/acquisition";
import {
  BUY_VS_SKIP_EXPLANATION_PROMPT_VERSION,
  buyVsSkipExplanationParser,
  buyVsSkipExplanationPromptBuilder,
  toExplanationInput,
  type BuyVsSkipExplanation,
} from "@/features/acquisition/ai/buy-vs-skip-explanation";

const TTL_SECONDS = 7 * 24 * 60 * 60;

function resolveModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

export interface ExplainBuyVsSkipDeps {
  runtime?: Pick<AIRuntime, "run">;
  now?: string;
  forceRefresh?: boolean;
}

export async function explainBuyVsSkip(
  analysis: BuyVsSkipAnalysis,
  deps: ExplainBuyVsSkipDeps = {},
): Promise<BuyVsSkipExplanation> {
  const runtime = deps.runtime ?? getServerAIRuntime();
  const model = resolveModel();
  const input = toExplanationInput(analysis);

  const built = buyVsSkipExplanationPromptBuilder.build({
    task: "buy-vs-skip-explanation",
    data: { input },
    now: deps.now,
  });

  const result = await runtime.run<BuyVsSkipExplanation>({
    capability: "explanation",
    request: {
      system: built.system,
      prompt: built.prompt,
      model,
      responseFormat: "json",
      temperature: 0.4,
      maxTokens: 500,
    },
    parser: buyVsSkipExplanationParser,
    forceRefresh: deps.forceRefresh,
    cache: {
      promptBuilder: buyVsSkipExplanationPromptBuilder.id,
      promptVersion: BUY_VS_SKIP_EXPLANATION_PROMPT_VERSION,
      model,
      input,
      ttlSeconds: TTL_SECONDS,
    },
  });

  if (!result.parsed) throw new Error("Explanation was not parsed.");
  return result.parsed;
}
