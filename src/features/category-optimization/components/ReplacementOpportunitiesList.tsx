"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";

import type { ReplacementOpportunity } from "@/domain/category-optimization";
import { useConfirmReplacementWishlistMutation } from "@/features/category-optimization/hooks/useCategoryOptimization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ReplacementOpportunitiesList({
  opportunities,
  estimatedHealthImprovement,
}: {
  opportunities: ReplacementOpportunity[];
  estimatedHealthImprovement?: number | null;
}) {
  const confirm = useConfirmReplacementWishlistMutation();
  const [addedId, setAddedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Replacement Opportunities</CardTitle>
        <CardDescription>
          Prospective stubs only. Add to wishlist on confirm, then run Buy vs
          Skip — nothing is auto-purchased.
          {estimatedHealthImprovement != null
            ? ` Plan estimates ~+${estimatedHealthImprovement} health if executed.`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {opportunities.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No replacement opportunities — this category looks balanced.
          </p>
        ) : (
          opportunities.map((op) => {
            const advisorHref = `/acquisition/advisor`;
            return (
              <div
                key={op.id}
                className="space-y-2 rounded-md border px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{op.name}</span>
                  <Badge variant="outline">{op.category}</Badge>
                </div>
                <p className="text-muted-foreground">{op.rationale}</p>
                <div className="flex flex-wrap gap-1">
                  {op.styleHints.map((h) => (
                    <Badge key={h} variant="secondary" className="text-[10px]">
                      {h}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={confirm.isPending}
                    onClick={() => {
                      setErrorId(null);
                      confirm.mutate(op, {
                        onSuccess: () => setAddedId(op.id),
                        onError: () => setErrorId(op.id),
                      });
                    }}
                  >
                    {confirm.isPending && confirm.variables?.id === op.id ? (
                      <Loader2Icon className="animate-spin" />
                    ) : null}
                    {addedId === op.id ? "Added to wishlist" : "Add to Wishlist"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={advisorHref} />}
                  >
                    Analyze Replacement
                  </Button>
                </div>
                {errorId === op.id ? (
                  <p className="text-xs text-destructive">
                    Couldn&apos;t add to wishlist. Try again.
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
