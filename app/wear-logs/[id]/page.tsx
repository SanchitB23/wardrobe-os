import type { Metadata } from "next";
import { Suspense } from "react";

import { WearLogDetailView } from "@/features/wear-logs/components/wear-log-detail-view";

export const metadata: Metadata = {
  title: "Wear Log",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function WearLogDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <WearLogDetailView id={id} />
    </Suspense>
  );
}
