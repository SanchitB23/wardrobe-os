"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { CategoryAnalysisPanel } from "@/features/category-optimization/components/CategoryAnalysisPanel";
import { ItemComparisonTable } from "@/features/category-optimization/components/ItemComparisonTable";
import { OptimizationPlanView } from "@/features/category-optimization/components/OptimizationPlanView";
import { ReplacementOpportunitiesList } from "@/features/category-optimization/components/ReplacementOpportunitiesList";
import { useCategoryOptimization } from "@/features/category-optimization/hooks/useCategoryOptimization";
import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function CategoryOptimizationView() {
  const params = useSearchParams();
  const categoryKey = params.get("category");
  const focusItemId = params.get("focus");

  const query = useCategoryOptimization(categoryKey, focusItemId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Optimize Category"
        badge={<Badge variant="secondary">RFC-015A</Badge>}
        description="Analyse a crowded category, compare peers, and get a keep / rotate / retire plan — without automatic destructive actions."
        actions={
          <Button variant="outline" render={<Link href="/intelligence" />}>
            Intelligence Center
          </Button>
        }
      />

      {!categoryKey ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <p>Choose a category from an Optimize card on the Intelligence Center.</p>
            <Button render={<Link href="/intelligence" />}>
              Open Intelligence Center
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {categoryKey && query.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Building optimization
            plan…
          </CardContent>
        </Card>
      ) : null}

      {categoryKey && query.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {query.error.message || "Couldn't load category optimization."}
          </CardContent>
        </Card>
      ) : null}

      {query.data ? (
        <>
          <ol className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {[
              "Category Analysis",
              "Item Comparison",
              "Optimization Plan",
              "Replacement Opportunities",
              "Execution",
            ].map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden>→</span> : null}
                <Badge variant="outline">{step}</Badge>
              </li>
            ))}
          </ol>

          <CategoryAnalysisPanel analysis={query.data.analysis} />
          <ItemComparisonTable
            comparisons={query.data.comparisons}
            focusItemId={focusItemId}
          />
          <OptimizationPlanView plan={query.data.plan} />
          <ReplacementOpportunitiesList
            opportunities={query.data.plan.replacementOpportunities}
            estimatedHealthImprovement={
              query.data.plan.estimatedHealthImprovement
            }
          />
        </>
      ) : null}
    </div>
  );
}
