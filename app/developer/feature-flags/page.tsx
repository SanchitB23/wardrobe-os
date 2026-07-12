import type { Metadata } from "next";

import { FeatureFlagsView } from "@/features/developer/components/feature-flags-view";
import { resolveFeatureFlags } from "@/shared/feature-flags";

export const metadata: Metadata = {
  title: "Feature Flags",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function FeatureFlagsPage() {
  return <FeatureFlagsView flags={resolveFeatureFlags()} />;
}
