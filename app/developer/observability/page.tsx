import type { Metadata } from "next";

import { ObservabilityView } from "@/features/developer/components/observability-view";
import { logRingBuffer } from "@/runtime/logging/ring-buffer";

export const metadata: Metadata = {
  title: "Observability",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ObservabilityPage() {
  const records = logRingBuffer.recent({ limit: 100 });
  return <ObservabilityView records={records} />;
}
