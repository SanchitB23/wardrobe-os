import type { Metadata } from "next";

import { VisionReviewView } from "@/features/vision/components";

export const metadata: Metadata = {
  title: "Vision Review",
};

export default function VisionReviewPage() {
  return <VisionReviewView />;
}
