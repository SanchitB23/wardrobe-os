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
import { wishlistItemHref } from "@/features/shopping/lib/wishlist-navigation";
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

type PurchaseIntent = "mark_only" | "then_convert";

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
  const [purchaseIntent, setPurchaseIntent] =
    useState<PurchaseIntent>("mark_only");

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
          onClick: () => router.push(wishlistItemHref(wishlist.id)),
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
      const marked = unwrapData(
        await markWishlistPurchased({
          wishlistId: ensured.id,
          purchasePrice: input.purchasePrice,
          purchaseDate: input.purchaseDate,
        }),
      );
      return { wishlist: marked, intent: purchaseIntent };
    },
    onSuccess: async ({ wishlist, intent }) => {
      setPurchaseOpen(false);
      await invalidate();
      if (intent === "then_convert") {
        toast.success("Marked purchased — continue conversion");
        router.push(`/acquisitions/convert/${wishlist.id}`);
        return;
      }
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
      return ensured;
    },
    onSuccess: (ensured) => {
      // Never silently mark purchased — dialog or wizard only.
      if (ensured.status === "purchased" || ensured.purchaseDate) {
        router.push(`/acquisitions/convert/${ensured.id}`);
        return;
      }
      setPurchaseIntent("then_convert");
      setPurchaseOpen(true);
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
            render={<Link href={wishlistItemHref(wishlistId)} />}
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
          onClick={() => {
            setPurchaseIntent("mark_only");
            setPurchaseOpen(true);
          }}
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
        onOpenChange={(open) => {
          setPurchaseOpen(open);
          if (!open) setPurchaseIntent("mark_only");
        }}
        itemName={item.name}
        defaultPrice={item.estimatedPrice}
        busy={purchaseMutation.isPending}
        onConfirm={(input) => purchaseMutation.mutate(input)}
      />
    </div>
  );
}
