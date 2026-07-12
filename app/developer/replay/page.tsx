import type { Metadata } from "next";

import { RequestReplayView } from "@/features/developer/components/request-replay-view";
import { replayStore } from "@/runtime/logging/request-replay";

export const metadata: Metadata = {
  title: "Request Replay",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function RequestReplayPage() {
  return (
    <RequestReplayView
      captures={replayStore.list()}
      captureEnabled={replayStore.enabled()}
    />
  );
}
