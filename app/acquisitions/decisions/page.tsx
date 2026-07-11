import type { Metadata } from "next";

import { DecisionHistoryView } from "@/features/shopping/components";

export const metadata: Metadata = {
  title: "Decision History",
};

export default function AcquisitionsDecisionsPage() {
  return <DecisionHistoryView />;
}
