import type { Metadata } from "next";

import { AcquisitionTimelineView } from "@/features/shopping/components";

export const metadata: Metadata = {
  title: "Acquisition Timeline",
};

export default function AcquisitionsTimelinePage() {
  return <AcquisitionTimelineView />;
}
