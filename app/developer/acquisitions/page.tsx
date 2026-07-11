import type { Metadata } from "next";

import { AcquisitionsDebugView } from "@/features/shopping/components";

export const metadata: Metadata = {
  title: "Acquisitions Debug",
};

export default function DeveloperAcquisitionsPage() {
  return <AcquisitionsDebugView />;
}
