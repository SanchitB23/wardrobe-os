import type { Metadata } from "next";

import { PlaygroundView } from "@/features/playground/components/playground-view";

export const metadata: Metadata = {
  title: "AI Playground",
  robots: { index: false, follow: false },
};

export default function AiPlaygroundPage() {
  return <PlaygroundView />;
}
