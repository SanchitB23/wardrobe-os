"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2Icon,
} from "lucide-react";

import type { BuyDecision, BuyVsSkipInputSource } from "@/domain/acquisition";
import {
  addAnalysisToWishlist,
  buildDecisionCardModel,
  ensureWishlistForAnalysis,
  markWishlistPurchased,
} from "@/features/shopping/services/acquisitionPipeline.service";
import { useDecisions, useWishlist } from "@/features/shopping/hooks";
import { MarkPurchasedDialog } from "@/features/shopping/components/mark-purchased-dialog";
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

const decisionVariant = (d: string) =>
  d === "buy" ? "default" : d === "consider" ? "secondary" : "outline";

const lifecycleLabel: Record<string, string> = {
  analyzed: "Analyzed",
  on_wishlist: "On wishlist",
  purchased: "Purchased",
  in_inventory: "In inventory",
  worn: "Worn",
  roi: "ROI",
};

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
  const [purchaseTarget, setPurchaseTarget] = useState<{
    decision: AcquisitionDecisionRecord;
    wishlistId?: string;
  } | null>(null);

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
  const wishlistById = useMemo(() => {
    const map = new Map<string, WishlistItem>();
    for (const w of wishlistQuery.data ?? []) map.set(w.id, w);
    return map;
  }, [wishlistQuery.data]);

  const cards = useMemo(
    () => (query.data ?? []).map((r) => buildDecisionCardModel(r, wishlistById)),
    [query.data, wishlistById],
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
    onSuccess: async () => {
      await invalidate();
      toast.success("Added to wishlist");
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
      return unwrapData(
        await markWishlistPurchased({
          wishlistId: ensured.id,
          purchasePrice: input.purchasePrice,
          purchaseDate: input.purchaseDate,
        }),
      );
    },
    onSuccess: async () => {
      setPurchaseTarget(null);
      await invalidate();
      toast.success("Marked purchased");
    },
    onError: (error: Error) => toast.error(error.message || "Failed"),
  });

  const convertMutation = useMutation({
    mutationFn: async (record: AcquisitionDecisionRecord) => {
      const ensured = unwrapData(
        await ensureWishlistForAnalysis({
          decisionId: record.id,
          item: record.itemSnapshot,
          source: record.source,
        }),
      );
      return ensured.id;
    },
    onSuccess: (id) => router.push(`/acquisitions/convert/${id}`),
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
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No decisions match these filters.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {cards.map((card) => {
          const r = card.decision;
          const open = expanded === r.id;
          return (
            <Card key={r.id}>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-start gap-3">
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.imageUrl}
                      alt=""
                      className="size-14 rounded object-cover"
                    />
                  ) : (
                    <div className="flex size-14 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      No img
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{r.itemName}</p>
                      <Badge variant={decisionVariant(r.decision)}>
                        {r.decision}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {card.source}
                      </Badge>
                      <Badge variant="secondary">
                        {lifecycleLabel[card.lifecycleStatus] ??
                          card.lifecycleStatus}
                      </Badge>
                      {r.score != null ? (
                        <span className="text-sm tabular-nums text-muted-foreground">
                          Score {r.score}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {r.summary || "No summary"} ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                      {card.wishlistItemId
                        ? " · Linked wishlist"
                        : " · Unlinked"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpanded(open ? null : r.id)}
                  >
                    {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
                    Details
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {card.actions.includes("add_to_wishlist") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addMutation.isPending}
                      onClick={() => addMutation.mutate(r)}
                    >
                      Add to Wishlist
                    </Button>
                  ) : null}
                  {card.actions.includes("view_wishlist") &&
                  card.wishlistItemId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href="/acquisitions/wishlist" />}
                    >
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
                          wishlistId: card.wishlistItemId ?? undefined,
                        })
                      }
                    >
                      Mark Purchased
                    </Button>
                  ) : null}
                  {card.actions.includes("convert_to_inventory") ? (
                    <Button
                      size="sm"
                      disabled={convertMutation.isPending}
                      onClick={() => convertMutation.mutate(r)}
                    >
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

                {open ? (
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                    {JSON.stringify(r.analysis, null, 2)}
                  </pre>
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
