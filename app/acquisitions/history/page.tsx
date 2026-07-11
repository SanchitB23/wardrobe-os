import type { Metadata } from "next";

import { ShoppingHistoryView } from "@/features/shopping/components";

export const metadata: Metadata = {
  title: "Shopping History",
};

export default function AcquisitionsHistoryPage() {
  return <ShoppingHistoryView />;
}
