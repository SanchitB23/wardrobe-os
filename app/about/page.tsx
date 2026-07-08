import type { Metadata } from "next";

import { AboutView } from "@/features/about/components/about-view";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return <AboutView />;
}
