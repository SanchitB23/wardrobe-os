import type { Metadata } from "next";

import { ScreenshotAdvisorView } from "@/features/acquisition/components/ScreenshotAdvisorView";

export const metadata: Metadata = {
  title: "Screenshot → Buy vs Skip",
};

export default function ScreenshotAdvisorPage() {
  return <ScreenshotAdvisorView />;
}
