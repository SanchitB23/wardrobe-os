import type { Metadata } from "next";

import { AcquisitionsLandingView } from "@/features/shopping/components";

export const metadata: Metadata = {
  title: "Acquisitions",
};

export default function AcquisitionsPage() {
  return <AcquisitionsLandingView />;
}
