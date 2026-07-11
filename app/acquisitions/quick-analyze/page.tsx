import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Quick Analyze",
};

/** Thin entry for the Acquisitions hub card — Buy vs Skip advisor is unchanged. */
export default function AcquisitionsQuickAnalyzePage() {
  redirect("/acquisition/advisor");
}
