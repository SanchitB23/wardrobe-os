import type { Metadata } from "next";

import { RuntimeStatisticsView } from "@/features/developer/components/runtime-statistics-view";
import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";
import { weatherRuntime } from "@/runtime/weather";

export const metadata: Metadata = {
  title: "Runtime Statistics",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function RuntimeStatisticsPage() {
  const runtime = getServerAIRuntime();
  return (
    <RuntimeStatisticsView
      ai={runtime.metricsSnapshot()}
      weather={weatherRuntime.metricsSnapshot()}
    />
  );
}
