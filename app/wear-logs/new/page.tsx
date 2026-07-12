import type { Metadata } from "next";

import { QuickWearLogView } from "@/features/wear-logs/components/quick-wear-log-view";

export const metadata: Metadata = {
  title: "Quick Log Wear",
};

type PageProps = {
  searchParams?: Promise<{ items?: string }>;
};

export default async function QuickWearLogPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const initialItemIds = (params.items ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return <QuickWearLogView initialItemIds={initialItemIds} />;
}
