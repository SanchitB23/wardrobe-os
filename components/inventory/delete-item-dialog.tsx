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
import { deleteWardrobeItem } from "@/lib/wardrobe/queries";
import type { WardrobeItemRow } from "@/types/wardrobe";

type DeleteItemDialogProps = {
  item: WardrobeItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteItemDialog({
  item,
  open,
  onOpenChange,
  onDeleted,
}: DeleteItemDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!item) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: deleteError } = await deleteWardrobeItem(item.id);
    setSubmitting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    onOpenChange(false);
    onDeleted();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete item</DialogTitle>
          <DialogDescription>
            {item ? (
              <>
                Permanently remove{" "}
                <span className="font-medium text-foreground">{item.name}</span>{" "}
                (<span className="font-mono text-xs">{item.code}</span>) from
                your inventory? This cannot be undone.
              </>
            ) : (
              "Remove this item from your inventory?"
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
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
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={submitting || !item}
          >
            {submitting ? "Deleting…" : "Delete item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
