import type { Metadata } from "next";

import { WardrobeRoiView } from "@/features/shopping/components";

export const metadata: Metadata = {
  title: "Wardrobe ROI",
};

export default function AcquisitionsRoiPage() {
  return <WardrobeRoiView />;
}
