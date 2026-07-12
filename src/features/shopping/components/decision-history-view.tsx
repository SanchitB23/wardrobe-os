"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ImageIcon,
  InboxIcon,
  Loader2Icon,
  PackagePlusIcon,
  ScanSearchIcon,
  ShoppingBagIcon,
} from "lucide-react";

import type { BuyDecision, BuyVsSkipInputSource } from "@/domain/acquisition";
import { DecisionAnalysisSummary } from "@/features/acquisition/components/DecisionAnalysisSummary";
import { DecisionLifecycleStepper } from "@/features/acquisition/components/DecisionLifecycleStepper";
import { DecisionVerdictBadge } from "@/features/acquisition/components/DecisionVerdictBadge";
import {
  addAnalysisToWishlist,
  buildDecisionCardModel,
  ensureWishlistForAnalysis,
  markWishlistPurchased,
  type DecisionCardModel,
  type DecisionWearStats,
} from "@/features/shopping/services/acquisitionPipeline.service";
import {
  useAcquisitionsHub,
  useDecisions,
  useWishlist,
} from "@/features/shopping/hooks";
import { MarkPurchasedDialog } from "@/features/shopping/components/mark-purchased-dialog";
import { wishlistItemHref } from "@/features/shopping/lib/wishlist-navigation";
import type {
  AcquisitionDecisionRecord,
  DecisionListFilters,
  WishlistItem,
} from "@/features/shopping/types";
import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";

type PurchaseTarget = {
  decision: AcquisitionDecisionRecord;
  intent: "mark_only" | "then_convert";
};

function DecisionThumbnail({ card }: { card: DecisionCardModel }) {
  if (card.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={card.imageUrl}
        alt=""
        className="size-16 shrink-0 rounded-md object-cover ring-1 ring-border"
      />
    );
  }
  if (card.source === "image") {
    return (
      <div
        className="flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md bg-muted/80 text-muted-foreground ring-1 ring-border"
        title="Image analysis"
      >
        <ScanSearchIcon className="size-5" aria-hidden />
        <span className="text-[9px] font-medium uppercase tracking-wide">
          Image
        </span>
      </div>
    );
  }
  return (
    <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground ring-1 ring-border">
      <ImageIcon className="size-5" aria-hidden />
    </div>
  );
}

export function DecisionHistoryView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<BuyDecision | "all">("all");
  const [source, setSource] = useState<BuyVsSkipInputSource | "all">("all");
  const [linkage, setLinkage] = useState<"all" | "linked" | "unlinked">("all");
  const [sort, setSort] = useState<"recent" | "high_score">("recent");
  const [highScore, setHighScore] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [purchaseTarget, setPurchaseTarget] = useState<PurchaseTarget | null>(
    null,
  );

  const filters: DecisionListFilters = useMemo(
    () => ({
      decision,
      source,
      linkage,
      sort,
      highScore: highScore || undefined,
      search: search.trim() || undefined,
      from: from || null,
      to: to || null,
    }),
    [decision, source, linkage, sort, highScore, search, from, to],
  );

  const query = useDecisions(filters);
  const wishlistQuery = useWishlist();
  const hub = useAcquisitionsHub();

  const wishlistById = useMemo(() => {
    const map = new Map<string, WishlistItem>();
    for (const w of wishlistQuery.data ?? []) map.set(w.id, w);
    return map;
  }, [wishlistQuery.data]);

  const wearByInventoryId = useMemo(() => {
    const map = new Map<string, DecisionWearStats>();
    for (const r of hub.data?.roi.realized ?? []) {
      map.set(r.itemId, { wears: r.wears, costPerWear: r.costPerWear });
    }
    return map;
  }, [hub.data?.roi.realized]);

  const cards = useMemo(
    () =>
      (query.data ?? []).map((r) =>
        buildDecisionCardModel(r, wishlistById, wearByInventoryId),
      ),
    [query.data, wishlistById, wearByInventoryId],
  );

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
    mutationFn: async (record: AcquisitionDecisionRecord) =>
      unwrapData(
        await addAnalysisToWishlist({
          decisionId: record.id,
          item: record.itemSnapshot,
          source: record.source,
        }),
      ),
    onSuccess: async (wishlist) => {
      await invalidate();
      toast.success("Added to wishlist", {
        action: {
          label: "View",
          onClick: () => router.push(wishlistItemHref(wishlist.id)),
        },
      });
    },
    onError: (error: Error) => toast.error(error.message || "Failed"),
  });

  const purchaseMutation = useMutation({
    mutationFn: async (input: {
      purchasePrice: number;
      purchaseDate: string;
    }) => {
      if (!purchaseTarget) throw new Error("No decision selected.");
      const ensured = unwrapData(
        await ensureWishlistForAnalysis({
          decisionId: purchaseTarget.decision.id,
          item: purchaseTarget.decision.itemSnapshot,
          source: purchaseTarget.decision.source,
        }),
      );
      const marked = unwrapData(
        await markWishlistPurchased({
          wishlistId: ensured.id,
          purchasePrice: input.purchasePrice,
          purchaseDate: input.purchaseDate,
        }),
      );
      return { wishlist: marked, intent: purchaseTarget.intent };
    },
    onSuccess: async ({ wishlist, intent }) => {
      setPurchaseTarget(null);
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
    mutationFn: async (card: DecisionCardModel) => {
      const ensured = unwrapData(
        await ensureWishlistForAnalysis({
          decisionId: card.decision.id,
          item: card.decision.itemSnapshot,
          source: card.decision.source,
        }),
      );
      return { ensured, card };
    },
    onSuccess: ({ ensured, card }) => {
      if (
        ensured.status === "purchased" ||
        ensured.purchaseDate ||
        card.wishlistStatus === "purchased"
      ) {
        router.push(`/acquisitions/convert/${ensured.id}`);
        return;
      }
      setPurchaseTarget({
        decision: card.decision,
        intent: "then_convert",
      });
    },
    onError: (error: Error) => toast.error(error.message || "Failed"),
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Decision History"
        badge={<Badge variant="secondary">Acquisitions</Badge>}
        description="Stored Buy vs Skip analyses with lifecycle actions — Add to Wishlist, Mark Purchased, Convert to Inventory."
        actions={
          <Button variant="outline" render={<Link href="/acquisitions" />}>
            Hub
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filters</CardTitle>
          <CardDescription>
            Decision, source, linkage, score, and search.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Decision</Label>
            <Select
              value={decision}
              onValueChange={(v) =>
                setDecision((v ?? "all") as BuyDecision | "all")
              }
            >
              <SelectTrigger className="w-36 capitalize">
                <span className="flex flex-1 text-left capitalize">
                  {decision}
                </span>
              </SelectTrigger>
              <SelectContent>
                {(["all", "buy", "consider", "skip"] as const).map((d) => (
                  <SelectItem key={d} value={d} className="capitalize">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Source</Label>
            <Select
              value={source}
              onValueChange={(v) =>
                setSource((v ?? "all") as BuyVsSkipInputSource | "all")
              }
            >
              <SelectTrigger className="w-32 capitalize">
                <span className="flex flex-1 text-left capitalize">{source}</span>
              </SelectTrigger>
              <SelectContent>
                {(["all", "manual", "image", "url"] as const).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Linkage</Label>
            <Select
              value={linkage}
              onValueChange={(v) =>
                setLinkage((v ?? "all") as "all" | "linked" | "unlinked")
              }
            >
              <SelectTrigger className="w-36 capitalize">
                <span className="flex flex-1 text-left capitalize">
                  {linkage}
                </span>
              </SelectTrigger>
              <SelectContent>
                {(["all", "linked", "unlinked"] as const).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sort</Label>
            <Select
              value={sort}
              onValueChange={(v) =>
                setSort((v ?? "recent") as "recent" | "high_score")
              }
            >
              <SelectTrigger className="w-36">
                <span className="flex flex-1 text-left">
                  {sort === "high_score" ? "High score" : "Recent"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="high_score">High score</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={highScore}
              onChange={(e) => setHighScore(e.target.checked)}
            />
            High score (≥70)
          </label>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or summary…"
            />
          </div>
        </CardContent>
      </Card>

      {query.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading decisions…
          </CardContent>
        </Card>
      ) : null}

      {query.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {query.error.message || "Couldn't load decisions."}
          </CardContent>
        </Card>
      ) : null}

      {query.data && cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No decisions match</p>
              <p className="text-sm text-muted-foreground">
                Run Buy vs Skip from the advisor to build history.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                render={<Link href="/acquisition/advisor" />}
              >
                Open advisor
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {cards.map((card) => {
          const r = card.decision;
          const open = expanded === r.id;
          return (
            <Card
              key={r.id}
              className="transition-colors hover:bg-muted/25"
            >
              <CardContent className="space-y-4 py-5">
                <div className="flex flex-wrap items-start gap-4">
                  <DecisionThumbnail card={card} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold tracking-tight">
                        {r.itemName}
                      </p>
                      <DecisionVerdictBadge decision={r.decision} />
                      <Badge variant="outline" className="capitalize">
                        {card.source}
                      </Badge>
                      {r.score != null ? (
                        <span className="text-sm tabular-nums text-muted-foreground">
                          Score {r.score}
                        </span>
                      ) : null}
                    </div>

                    <DecisionLifecycleStepper
                      status={card.lifecycleStatus}
                      wears={card.wears}
                      costPerWear={card.costPerWear}
                    />

                    <p className="text-sm text-muted-foreground">
                      {r.summary || "No summary"} ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </p>

                    {card.wishlistItemId ? (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Wishlist · </span>
                        <Link
                          href={wishlistItemHref(card.wishlistItemId)}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {card.wishlistItemName ?? "Wishlist item"}
                        </Link>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Not on wishlist yet
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => setExpanded(open ? null : r.id)}
                    aria-expanded={open}
                  >
                    {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
                    Details
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                  {card.actions.includes("add_to_wishlist") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addMutation.isPending}
                      onClick={() => addMutation.mutate(r)}
                    >
                      <ShoppingBagIcon className="size-4" />
                      Add to Wishlist
                    </Button>
                  ) : null}
                  {card.actions.includes("view_wishlist") &&
                  card.wishlistItemId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      render={
                        <Link href={wishlistItemHref(card.wishlistItemId)} />
                      }
                    >
                      <ShoppingBagIcon className="size-4" />
                      View Wishlist
                    </Button>
                  ) : null}
                  {card.actions.includes("mark_purchased") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPurchaseTarget({
                          decision: r,
                          intent: "mark_only",
                        })
                      }
                    >
                      <CheckCircle2Icon className="size-4" />
                      Mark Purchased
                    </Button>
                  ) : null}
                  {card.actions.includes("convert_to_inventory") ? (
                    <Button
                      size="sm"
                      disabled={convertMutation.isPending}
                      onClick={() => convertMutation.mutate(card)}
                    >
                      <PackagePlusIcon className="size-4" />
                      Convert to Inventory
                    </Button>
                  ) : null}
                  {card.actions.includes("view_inventory") &&
                  card.inventoryItemId ? (
                    <Button
                      size="sm"
                      render={
                        <Link href={`/inventory/${card.inventoryItemId}`} />
                      }
                    >
                      View Inventory
                    </Button>
                  ) : null}
                </div>

                {open && r.analysis ? (
                  <DecisionAnalysisSummary analysis={r.analysis} />
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <MarkPurchasedDialog
        open={purchaseTarget != null}
        onOpenChange={(open) => {
          if (!open) setPurchaseTarget(null);
        }}
        itemName={purchaseTarget?.decision.itemName}
        defaultPrice={
          purchaseTarget?.decision.itemSnapshot.estimatedPrice ?? null
        }
        busy={purchaseMutation.isPending}
        onConfirm={(input) => purchaseMutation.mutate(input)}
      />
    </div>
  );
}
