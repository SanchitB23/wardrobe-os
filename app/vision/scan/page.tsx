import type { Metadata } from "next";
import { Suspense } from "react";

import { VisionScanView } from "@/features/vision/components";

export const metadata: Metadata = {
  title: "Vision Scan",
};

export default function VisionScanPage() {
  return (
    <Suspense fallback={null}>
      <VisionScanView />
    </Suspense>
  );
}
