import type { Metadata } from "next";

import { ScreenshotAdvisorView } from "@/features/acquisition/components/ScreenshotAdvisorView";

export const metadata: Metadata = {
  title: "Buy vs Skip Advisor",
};

export default function AcquisitionAdvisorPage() {
  return <ScreenshotAdvisorView />;
}
