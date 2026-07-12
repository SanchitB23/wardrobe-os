"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import {
  useDeleteWearLogEventMutation,
  usePromoteWearLogMutation,
  useUpdateWearLogEventMutation,
  useWearLogEvent,
} from "@/features/wear-logs/hooks";
import type { WearLogEventDetail } from "@/features/wear-logs/services/wear-events.service";
import { formatWearLogDisplayDate } from "@/features/wear-logs/services/wear-logs.service";
import { ItemPreviewDialog } from "@/features/inventory/components/item-preview-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SOURCE_LABEL: Record<string, string> = {
  ad_hoc: "Ad-hoc",
  outfit: "Saved outfit",
  recommendation: "Recommendation",
  trip: "Trip",
  ai: "AI",
};

export function WearLogDetailView({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const query = useWearLogEvent(id);

  if (query.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-destructive">
        {query.error?.message ?? "Wear log not found."}
        <div className="mt-4">
          <Button variant="outline" render={<Link href="/wear-logs" />}>
            Back to wear logs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <WearLogDetailLoaded
      detail={query.data}
      initialPromote={searchParams.get("promote") === "1"}
    />
  );
}

function WearLogDetailLoaded({
  detail,
  initialPromote,
}: {
  detail: WearLogEventDetail;
  initialPromote: boolean;
}) {
  const router = useRouter();
  const updateMutation = useUpdateWearLogEventMutation();
  const deleteMutation = useDeleteWearLogEventMutation();
  const promoteMutation = usePromoteWearLogMutation();

  const [notes, setNotes] = useState(detail.notes ?? "");
  const [wornOn, setWornOn] = useState(detail.wornOn);
  const [promoteOpen, setPromoteOpen] = useState(initialPromote);
  const [promoteName, setPromoteName] = useState("");
  const [promoteFavorite, setPromoteFavorite] = useState(false);
  const [promoteTags, setPromoteTags] = useState("");
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={formatWearLogDisplayDate(detail.wornOn)}
        badge={
          <Badge variant="outline">
            {SOURCE_LABEL[detail.source] ?? detail.source}
          </Badge>
        }
        description="Historical wear event — not a curated outfit unless you promote it."
        actions={
          <Button variant="outline" render={<Link href="/wear-logs" />}>
            All wear logs
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Items worn</CardTitle>
          <CardDescription>
            {detail.itemDetails.length} item
            {detail.itemDetails.length === 1 ? "" : "s"}
            {detail.occasionName ? ` · ${detail.occasionName}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {detail.itemDetails.map((item) => (
              <li
                key={item.itemId}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    onClick={() => setPreviewItemId(item.itemId)}
                  >
                    {item.name}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {[item.slot, item.categoryName].filter(Boolean).join(" · ") ||
                      item.code}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="detail-date">Date</Label>
            <Input
              id="detail-date"
              type="date"
              value={wornOn}
              onChange={(e) => setWornOn(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-notes">Notes</Label>
            <Textarea
              id="detail-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          {detail.outfitId ? (
            <p className="text-sm">
              Linked outfit:{" "}
              <Link
                href={`/outfits/${detail.outfitId}`}
                className="font-medium underline"
              >
                {detail.outfitName ?? "Open outfit"}
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No linked saved outfit.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              disabled={updateMutation.isPending}
              onClick={() =>
                updateMutation.mutate({
                  id: detail.id,
                  wornOn,
                  notes,
                })
              }
            >
              Save changes
            </Button>
            {!detail.outfitId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPromoteOpen(true)}
              >
                Save as Outfit
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Delete this wear log? Saved outfits are not deleted.",
                  )
                ) {
                  deleteMutation.mutate(detail.id, {
                    onSuccess: () => router.push("/wear-logs"),
                  });
                }
              }}
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Outfit</DialogTitle>
            <DialogDescription>
              Create a curated saved outfit from this wear log. Nothing is saved
              until you confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="promote-name">Name</Label>
              <Input
                id="promote-name"
                value={promoteName}
                onChange={(e) => setPromoteName(e.target.value)}
                placeholder="e.g. Weekend brunch"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promote-tags">Tags (optional)</Label>
              <Input
                id="promote-tags"
                value={promoteTags}
                onChange={(e) => setPromoteTags(e.target.value)}
                placeholder="comma-separated"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={promoteFavorite}
                onChange={(e) => setPromoteFavorite(e.target.checked)}
              />
              Mark as favorite
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromoteOpen(false)}
              disabled={promoteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={promoteMutation.isPending || !promoteName.trim()}
              onClick={() =>
                promoteMutation.mutate(
                  {
                    wearLogId: detail.id,
                    name: promoteName,
                    favorite: promoteFavorite,
                    tags: promoteTags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  },
                  { onSuccess: () => setPromoteOpen(false) },
                )
              }
            >
              {promoteMutation.isPending ? "Saving…" : "Create outfit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ItemPreviewDialog
        itemId={previewItemId}
        open={previewItemId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewItemId(null);
        }}
      />
    </div>
  );
}
