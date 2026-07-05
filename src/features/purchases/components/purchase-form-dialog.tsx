"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

import {
  useCreatePurchaseMutation,
  useUpdatePurchaseMutation,
} from "@/features/purchases/hooks";
import { formatPurchaseDateInput } from "@/features/purchases/services/purchases.service";
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
import {
  formatEnumLabel,
  PURCHASE_STATUSES,
  type PurchaseRow,
  type PurchaseStatus,
  type WardrobeItemRow,
} from "@/types/wardrobe";

type PurchaseFormDialogProps = {
  item: Pick<WardrobeItemRow, "id" | "name" | "code">;
  purchase?: PurchaseRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function PurchaseFormDialogBody({
  item,
  purchase,
  onOpenChange,
}: Omit<PurchaseFormDialogProps, "open">) {
  const isEdit = Boolean(purchase);
  const [purchaseDate, setPurchaseDate] = useState(
    () => purchase?.purchase_date ?? formatPurchaseDateInput(),
  );
  const [price, setPrice] = useState(
    () => (purchase ? String(purchase.price) : ""),
  );
  const [source, setSource] = useState(() => purchase?.source ?? "");
  const [status, setStatus] = useState<PurchaseStatus | string>(
    () => purchase?.status ?? "active",
  );
  const [returnReason, setReturnReason] = useState(
    () => purchase?.return_reason ?? "",
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const createMutation = useCreatePurchaseMutation();
  const updateMutation = useUpdatePurchaseMutation();
  const submitting = createMutation.isPending || updateMutation.isPending;

  const selectedStatusLabel = status
    ? formatEnumLabel(String(status))
    : "Active";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(null);

    if (!purchaseDate.trim()) {
      setValidationError("Purchase date is required.");
      return;
    }

    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setValidationError("Price must be a valid non-negative number.");
      return;
    }

    if (status === "returned" && !returnReason.trim()) {
      setValidationError("Return reason is required when status is returned.");
      return;
    }

    const payload = {
      item_id: item.id,
      purchase_date: purchaseDate,
      price: parsedPrice,
      source,
      status,
      return_reason: status === "returned" ? returnReason : null,
    };

    try {
      if (isEdit && purchase) {
        await updateMutation.mutateAsync({ id: purchase.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // Mutation onError shows toast.
    }
  }

  const mutationError = createMutation.error ?? updateMutation.error;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit purchase" : "Add purchase"}</DialogTitle>
        <DialogDescription>
          {isEdit ? "Update purchase details for" : "Record purchase details for"}{" "}
          <span className="font-medium text-foreground">{item.name}</span> (
          <span className="font-mono text-xs">{item.code}</span>).
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="purchase-date">Purchase date</Label>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="purchase-date"
              type="date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              className="pl-9"
              disabled={submitting}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="purchase-price">Price</Label>
          <Input
            id="purchase-price"
            type="number"
            min={0}
            step={0.01}
            inputMode="decimal"
            placeholder="0.00"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="purchase-source">Purchase source</Label>
          <Input
            id="purchase-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Store, website, marketplace…"
            disabled={submitting}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Purchase status</Label>
          <Select
            value={String(status)}
            onValueChange={(value) => setStatus(value ?? "active")}
            disabled={submitting}
          >
            <SelectTrigger className="w-full">
              <span className="flex flex-1 truncate text-left">
                {selectedStatusLabel}
              </span>
            </SelectTrigger>
            <SelectContent>
              {PURCHASE_STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  {formatEnumLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {status === "returned" ? (
          <div className="space-y-1.5">
            <Label htmlFor="purchase-return-reason">Return reason</Label>
            <Textarea
              id="purchase-return-reason"
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="Why was this item returned?"
              rows={3}
              disabled={submitting}
              required
            />
          </div>
        ) : null}

        {(validationError || mutationError) && (
          <p className="text-sm text-destructive" role="alert">
            {validationError ?? mutationError?.message}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Add purchase"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function PurchaseFormDialog({
  item,
  purchase,
  open,
  onOpenChange,
}: PurchaseFormDialogProps) {
  const dialogKey = open
    ? `${item.id}:${purchase?.id ?? "new"}`
    : "closed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <PurchaseFormDialogBody
          key={dialogKey}
          item={item}
          purchase={purchase}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  );
}
