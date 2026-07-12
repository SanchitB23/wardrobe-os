/**
 * Manual status probes (RFC-028). Never called automatically. AI probes run
 * through the runtime so the budget guard and cost tracker observe them; the
 * provider is targeted by picking a capability it currently serves as primary.
 */

import { NextResponse } from "next/server";

import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";
import type { ServiceId } from "@/domain/status";
import { createClient } from "@/lib/supabase/server";
import type { AICapability } from "@/runtime/ai";
import { withApiLogging } from "@/runtime/logging/api-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProbeResult = {
  id: ServiceId;
  ok: boolean;
  latencyMs: number;
  skipped?: boolean;
  error?: string;
};

async function timed(
  id: ServiceId,
  fn: () => Promise<void>,
): Promise<ProbeResult> {
  const start = Date.now();
  try {
    await fn();
    return { id, ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      id,
      ok: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function capabilityFor(provider: "gemini" | "openai"): AICapability | null {
  const aiRuntime = getServerAIRuntime();
  const resolver = aiRuntime.getPolicyResolver();
  const capabilities = Object.keys(aiRuntime.getPolicies()) as AICapability[];
  return (
    capabilities.find(
      (capability) => resolver.describe(capability).provider === provider,
    ) ?? null
  );
}

async function probeAI(provider: "gemini" | "openai"): Promise<ProbeResult> {
  // Everything (including capability resolution) stays inside this try/catch
  // so a single broken probe degrades to a failed row instead of rejecting
  // the whole `Promise.all` in handleProbe and 500ing the batch.
  const start = Date.now();
  try {
    const capability = capabilityFor(provider);
    if (!capability) {
      return { id: provider, ok: true, latencyMs: 0, skipped: true };
    }
    return await timed(provider, async () => {
      // `run()` throws (AIError) on failure rather than returning a status
      // field (see AIRuntime.run / src/ai/types AIResponse) — `timed` catches
      // it. `disableFallback` pins the call to THIS capability's primary
      // provider so each probe measures one provider in isolation: a Gemini
      // probe reflects Gemini's true state and never gets silently served (or
      // dragged down) by the OpenAI fallback, and vice versa.
      await getServerAIRuntime().run({
        capability,
        disableFallback: true,
        request: {
          system: "You are a health check. Reply with the single word: ok",
          prompt: "ok?",
          // Not 4: GPT-5 / Gemini 2.5 are reasoning models that spend the
          // output-token budget on internal reasoning first, so too small a cap
          // yields empty content and a false "empty response" probe failure.
          maxTokens: 64,
        },
      });
    });
  } catch (error) {
    return {
      id: provider,
      ok: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function probeSupabase(): Promise<ProbeResult> {
  return timed("supabase", async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("occasions")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
  });
}

async function probeOpenMeteo(): Promise<ProbeResult> {
  return timed("open_meteo", async () => {
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m",
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  });
}

async function handleProbe(request: Request): Promise<Response> {
  void request;
  const results = await Promise.all([
    probeAI("gemini"),
    probeAI("openai"),
    probeSupabase(),
    probeOpenMeteo(),
  ]);
  return NextResponse.json({ results });
}

export const POST = withApiLogging("/api/status/probe", handleProbe);
