"use client";

import { useState } from "react";
import { CalendarDaysIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWearOutfitMutation, useOccasions } from "@/features/wear-logs/hooks";
import type { OutfitDetail } from "@/features/outfits/types";
import { formatWearLogDateInput } from "@/features/wear-logs/services/wear-logs.service";

type WearOutfitDialogProps = {
  outfit: OutfitDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type WearOutfitDialogBodyProps = {
  outfit: OutfitDetail;
  onOpenChange: (open: boolean) => void;
};

function WearOutfitDialogBody({ outfit, onOpenChange }: WearOutfitDialogBodyProps) {
  const wornOn = formatWearLogDateInput();
  const [occasionId, setOccasionId] = useState<string | null>(
    outfit.occasion_id ?? null,
  );
  const [comfortRating, setComfortRating] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const occasionsQuery = useOccasions();
  const wearMutation = useWearOutfitMutation();
  const occasions = occasionsQuery.data ?? [];

  const itemIds = outfit.items
    .map((entry) => entry.item_id)
    .filter((itemId, index, array) => array.indexOf(itemId) === index);

  const selectedOccasionName =
    occasions.find((occasion) => occasion.id === occasionId)?.name ?? null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(null);

    if (itemIds.length === 0) {
      setValidationError("This outfit has no items to log.");
      return;
    }

    let parsedComfort: number | null = null;
    if (comfortRating.trim()) {
      parsedComfort = Number(comfortRating);
      if (
        Number.isNaN(parsedComfort) ||
        parsedComfort < 0 ||
        parsedComfort > 10
      ) {
        setValidationError("Comfort rating must be between 0 and 10.");
        return;
      }
    }

    try {
      await wearMutation.mutateAsync({
        outfit_id: outfit.id,
        item_ids: itemIds,
        worn_on: wornOn,
        occasion_id: occasionId,
        comfort_rating: parsedComfort,
        notes,
      });
      onOpenChange(false);
    } catch {
      // Mutation onError shows toast.
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Wear outfit</DialogTitle>
        <DialogDescription>
          Log wear for all{" "}
          <span className="font-medium text-foreground">{itemIds.length}</span>{" "}
          item{itemIds.length === 1 ? "" : "s"} in{" "}
          <span className="font-medium text-foreground">{outfit.name}</span>{" "}
          on today&apos;s date.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="size-4 shrink-0" />
            <span>
              Worn on{" "}
              <span className="font-medium text-foreground">
                {new Date(`${wornOn}T12:00:00`).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Occasion</Label>
          <Select
            value={occasionId ?? ""}
            onValueChange={(next) => setOccasionId(next ? next : null)}
            disabled={wearMutation.isPending || occasionsQuery.isPending}
          >
            <SelectTrigger className="w-full">
              <span
                className={
                  selectedOccasionName
                    ? "flex flex-1 truncate text-left"
                    : "flex flex-1 truncate text-left text-muted-foreground"
                }
              >
                {selectedOccasionName ?? "None"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {occasions.map((occasion) => (
                <SelectItem key={occasion.id} value={occasion.id}>
                  {occasion.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wear-outfit-comfort">Comfort rating</Label>
          <Input
            id="wear-outfit-comfort"
            type="number"
            min={0}
            max={10}
            step={0.5}
            inputMode="decimal"
            placeholder="0–10 (optional)"
            value={comfortRating}
            onChange={(event) => setComfortRating(event.target.value)}
            disabled={wearMutation.isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wear-outfit-notes">Notes</Label>
          <Textarea
            id="wear-outfit-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional context about the wear"
            rows={3}
            disabled={wearMutation.isPending}
          />
        </div>

        {(validationError || wearMutation.error) && (
          <p className="text-sm text-destructive" role="alert">
            {validationError ?? wearMutation.error?.message}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={wearMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={wearMutation.isPending || itemIds.length === 0}>
            {wearMutation.isPending ? "Logging…" : "Wear outfit"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function WearOutfitDialog({
  outfit,
  open,
  onOpenChange,
}: WearOutfitDialogProps) {
  const dialogKey = open && outfit ? outfit.id : "closed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && outfit ? (
        <WearOutfitDialogBody
          key={dialogKey}
          outfit={outfit}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  );
}
