import type { Metadata } from "next";

import { ShoppingView } from "@/features/shopping/components";

export const metadata: Metadata = {
  title: "Shopping Intelligence",
};

export default function AcquisitionsIntelligencePage() {
  return <ShoppingView />;
}
