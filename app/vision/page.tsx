import type { Metadata } from "next";

import { VisionHubView } from "@/features/vision/components";

export const metadata: Metadata = {
  title: "Vision",
};

export default function VisionPage() {
  return <VisionHubView />;
}
