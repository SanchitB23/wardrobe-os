import type { Metadata } from "next";
import { Suspense } from "react";

import { CategoryOptimizationView } from "@/features/category-optimization/pages/CategoryOptimizationView";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Optimize Category",
};

function OptimizeFallback() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading optimization…
        </CardContent>
      </Card>
    </div>
  );
}

export default function IntelligenceOptimizePage() {
  return (
    <Suspense fallback={<OptimizeFallback />}>
      <CategoryOptimizationView />
    </Suspense>
  );
}
