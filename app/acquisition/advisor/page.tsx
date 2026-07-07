import type { Metadata } from "next";

import { AcquisitionAdvisorView } from "@/features/acquisition/components/AcquisitionAdvisorView";

export const metadata: Metadata = {
  title: "Buy vs Skip Advisor",
};

export default function AcquisitionAdvisorPage() {
  return <AcquisitionAdvisorView />;
}
