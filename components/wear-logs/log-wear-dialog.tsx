"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

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
import { useCreateWearLogMutation, useOccasions } from "@/lib/wardrobe/hooks";
import {
  formatWearLogDateInput,
} from "@/lib/wardrobe/wear-logs";
import type { WardrobeItemRow } from "@/types/wardrobe";

type LogWearDialogProps = {
  item: Pick<WardrobeItemRow, "id" | "name" | "code"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type LogWearDialogBodyProps = {
  item: Pick<WardrobeItemRow, "id" | "name" | "code">;
  onOpenChange: (open: boolean) => void;
};

function LogWearDialogBody({ item, onOpenChange }: LogWearDialogBodyProps) {
  const [wornOn, setWornOn] = useState(() => formatWearLogDateInput());
  const [occasionId, setOccasionId] = useState<string | null>(null);
  const [comfortRating, setComfortRating] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const occasionsQuery = useOccasions();
  const createMutation = useCreateWearLogMutation();
  const occasions = occasionsQuery.data ?? [];

  const selectedOccasionName =
    occasions.find((occasion) => occasion.id === occasionId)?.name ?? null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(null);

    if (!wornOn.trim()) {
      setValidationError("Worn date is required.");
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
      await createMutation.mutateAsync({
        item_id: item.id,
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
        <DialogTitle>Log wear</DialogTitle>
        <DialogDescription>
          Record when you wore{" "}
          <span className="font-medium text-foreground">{item.name}</span> (
          <span className="font-mono text-xs">{item.code}</span>).
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="wear-log-date">Worn on</Label>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="wear-log-date"
              type="date"
              value={wornOn}
              onChange={(event) => setWornOn(event.target.value)}
              className="pl-9"
              disabled={createMutation.isPending}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Occasion</Label>
          <Select
            value={occasionId ?? ""}
            onValueChange={(next) => setOccasionId(next ? next : null)}
            disabled={createMutation.isPending || occasionsQuery.isPending}
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
          <Label htmlFor="wear-log-comfort">Comfort rating</Label>
          <Input
            id="wear-log-comfort"
            type="number"
            min={0}
            max={10}
            step={0.5}
            inputMode="decimal"
            placeholder="0–10 (optional)"
            value={comfortRating}
            onChange={(event) => setComfortRating(event.target.value)}
            disabled={createMutation.isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wear-log-notes">Notes</Label>
          <Textarea
            id="wear-log-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional context about the wear"
            rows={3}
            disabled={createMutation.isPending}
          />
        </div>

        {(validationError || createMutation.error) && (
          <p className="text-sm text-destructive" role="alert">
            {validationError ?? createMutation.error?.message}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Saving…" : "Log wear"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function LogWearDialog({
  item,
  open,
  onOpenChange,
}: LogWearDialogProps) {
  const dialogKey = open && item ? item.id : "closed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && item ? (
        <LogWearDialogBody
          key={dialogKey}
          item={item}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  );
}
