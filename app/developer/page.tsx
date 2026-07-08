import type { Metadata } from "next";

import { DeveloperView } from "@/features/developer/components/developer-view";

export const metadata: Metadata = {
  title: "Developer",
  robots: { index: false, follow: false },
};

export default function DeveloperPage() {
  return <DeveloperView />;
}
