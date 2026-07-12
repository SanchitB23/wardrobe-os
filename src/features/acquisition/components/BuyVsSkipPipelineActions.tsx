"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  PackagePlusIcon,
  ShoppingBagIcon,
} from "lucide-react";

import type {
  BuyVsSkipAnalysis,
  BuyVsSkipInputSource,
  ProspectiveItem,
} from "@/domain/acquisition";
import {
  addAnalysisToWishlist,
  ensureWishlistForAnalysis,
  type ImageCandidate,
} from "@/features/shopping/services/acquisitionPipeline.service";
import { markWishlistPurchased } from "@/features/shopping/services/acquisitionPipeline.service";
import { MarkPurchasedDialog } from "@/features/shopping/components/mark-purchased-dialog";
import { Button } from "@/components/ui/button";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

type BuyVsSkipPipelineActionsProps = {
  analysis: BuyVsSkipAnalysis;
  item: ProspectiveItem;
  source: BuyVsSkipInputSource;
  decisionId?: string | null;
  imageCandidate?: ImageCandidate | null;
};

export function BuyVsSkipPipelineActions({
  analysis,
  item,
  source,
  decisionId,
  imageCandidate,
}: BuyVsSkipPipelineActionsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: wardrobeKeys.wishlist() });
    await queryClient.invalidateQueries({
      queryKey: wardrobeKeys.acquisitionsHub(),
    });
    await queryClient.invalidateQueries({
      queryKey: [...wardrobeKeys.all, "acquisition-decisions"],
    });
  }

  const addMutation = useMutation({
    mutationFn: async () =>
      unwrapData(
        await addAnalysisToWishlist({
          decisionId,
          item,
          source,
          imageCandidate,
        }),
      ),
    onSuccess: async (wishlist) => {
      setWishlistId(wishlist.id);
      await invalidate();
      toast.success("Added to wishlist", {
        action: {
          label: "View",
          onClick: () => router.push("/acquisitions/wishlist"),
        },
      });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add"),
  });

  const purchaseMutation = useMutation({
    mutationFn: async (input: {
      purchasePrice: number;
      purchaseDate: string;
    }) => {
      const ensured = unwrapData(
        await ensureWishlistForAnalysis({
          decisionId,
          item,
          source,
          imageCandidate,
        }),
      );
      setWishlistId(ensured.id);
      return unwrapData(
        await markWishlistPurchased({
          wishlistId: ensured.id,
          purchasePrice: input.purchasePrice,
          purchaseDate: input.purchaseDate,
        }),
      );
    },
    onSuccess: async () => {
      setPurchaseOpen(false);
      await invalidate();
      toast.success("Marked purchased");
    },
    onError: (error: Error) => toast.error(error.message || "Failed"),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const ensured = unwrapData(
        await ensureWishlistForAnalysis({
          decisionId,
          item,
          source,
          imageCandidate,
        }),
      );
      setWishlistId(ensured.id);
      if (ensured.status !== "purchased" && !ensured.purchaseDate) {
        // Wizard can still run; mark purchased intent with estimate if present.
        if (item.estimatedPrice != null) {
          await markWishlistPurchased({
            wishlistId: ensured.id,
            purchasePrice: item.estimatedPrice,
            purchaseDate: new Date().toISOString().slice(0, 10),
          });
        }
      }
      return ensured.id;
    },
    onSuccess: (id) => {
      router.push(`/acquisitions/convert/${id}`);
    },
    onError: (error: Error) => toast.error(error.message || "Failed"),
  });

  const busy =
    addMutation.isPending ||
    purchaseMutation.isPending ||
    convertMutation.isPending;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Next steps · score {analysis.score} · {analysis.decision}
      </div>
      <div className="flex flex-wrap gap-2">
        {wishlistId ? (
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/acquisitions/wishlist" />}
          >
            <ShoppingBagIcon className="size-4" />
            View Wishlist Item
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => addMutation.mutate()}
          >
            <ShoppingBagIcon className="size-4" />
            Add to Wishlist
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setPurchaseOpen(true)}
        >
          <CheckCircle2Icon className="size-4" />
          Mark Purchased
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => convertMutation.mutate()}
        >
          <PackagePlusIcon className="size-4" />
          Create Inventory Item
        </Button>
      </div>

      <MarkPurchasedDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        itemName={item.name}
        defaultPrice={item.estimatedPrice}
        busy={purchaseMutation.isPending}
        onConfirm={(input) => purchaseMutation.mutate(input)}
      />
    </div>
  );
}
