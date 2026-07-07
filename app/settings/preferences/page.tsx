import type { Metadata } from "next";

import { PreferencesView } from "@/features/personalization/components/PreferencesView";

export const metadata: Metadata = {
  title: "Preferences",
};

export default function PreferencesPage() {
  return <PreferencesView />;
}
