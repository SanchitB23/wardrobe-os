import type { Metadata } from "next";

import { VisionDebugView } from "@/features/vision/components";

export const metadata: Metadata = {
  title: "Vision Debug",
};

export default function DeveloperVisionPage() {
  return <VisionDebugView />;
}
