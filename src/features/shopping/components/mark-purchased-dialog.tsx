"use client";

import { useState } from "react";

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

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type MarkPurchasedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPrice?: number | null;
  defaultDate?: string | null;
  itemName?: string;
  busy?: boolean;
  onConfirm: (input: { purchasePrice: number; purchaseDate: string }) => void;
};

export function MarkPurchasedDialog({
  open,
  onOpenChange,
  defaultPrice,
  defaultDate,
  itemName,
  busy,
  onConfirm,
}: MarkPurchasedDialogProps) {
  const [price, setPrice] = useState(
    defaultPrice != null ? String(defaultPrice) : "",
  );
  const [date, setDate] = useState(defaultDate?.slice(0, 10) || todayIsoDate());
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    const parsed = Number(price);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a valid purchase price.");
      return;
    }
    if (!date.trim()) {
      setError("Enter a purchase date.");
      return;
    }
    setError(null);
    onConfirm({ purchasePrice: parsed, purchaseDate: date.slice(0, 10) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark purchased</DialogTitle>
          <DialogDescription>
            {itemName
              ? `Record purchase details for “${itemName}”. Inventory is created separately after you confirm.`
              : "Record purchase price and date. Inventory is created separately after you confirm."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="purchase-price">Purchase price</Label>
            <Input
              id="purchase-price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchase-date">Purchase date</Label>
            <Input
              id="purchase-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy}>
            {busy ? "Saving…" : "Mark purchased"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
