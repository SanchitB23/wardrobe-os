import type { Metadata } from "next";

import { WearLogsDeveloperView } from "@/features/wear-logs/components/wear-logs-developer-view";

export const metadata: Metadata = {
  title: "Wear Logs Runtime",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function DeveloperWearLogsPage() {
  return <WearLogsDeveloperView />;
}
