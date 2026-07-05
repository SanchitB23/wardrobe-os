"use client";

import { useState } from "react";
import { AlertTriangleIcon, ArchiveIcon, Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useBulkCleanupMutation } from "@/features/inventory/hooks";
import type { BulkCleanupMode } from "@/types/wardrobe";

type ReviewCleanupDialogProps = {
  open: boolean;
  itemIds: string[];
  itemLabel?: string;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function ReviewCleanupDialog({
  open,
  itemIds,
  itemLabel,
  onOpenChange,
  onCompleted,
}: ReviewCleanupDialogProps) {
  const [hardDelete, setHardDelete] = useState(false);
  const cleanupMutation = useBulkCleanupMutation();

  const count = itemIds.length;
  const mode: BulkCleanupMode = hardDelete ? "hard_delete" : "retire";

  async function handleConfirm() {
    if (count === 0) {
      return;
    }

    try {
      await cleanupMutation.mutateAsync({ ids: itemIds, mode });
      setHardDelete(false);
      onOpenChange(false);
      onCompleted?.();
    } catch {
      // Mutation onError shows toast.
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setHardDelete(false);
          cleanupMutation.reset();
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia>
            {hardDelete ? (
              <Trash2Icon className="text-destructive" />
            ) : (
              <ArchiveIcon className="text-muted-foreground" />
            )}
          </AlertDialogMedia>
          <AlertDialogTitle>
            {hardDelete
              ? `Permanently delete ${count} item${count === 1 ? "" : "s"}?`
              : `Retire ${count} item${count === 1 ? "" : "s"}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {itemLabel ? (
              <>
                Selected:{" "}
                <span className="font-medium text-foreground">{itemLabel}</span>
                {count > 1 ? ` and ${count - 1} more` : ""}.
              </>
            ) : null}{" "}
            {hardDelete
              ? "This removes items and related records permanently. This cannot be undone."
              : "Items will be marked retired and stay in your catalog for audit purposes."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border"
            checked={hardDelete}
            onChange={(event) => setHardDelete(event.target.checked)}
            disabled={cleanupMutation.isPending}
          />
          <span>
            <Label className="text-foreground">Permanently delete</Label>
            <span className="mt-1 block text-muted-foreground">
              Skip soft retire and hard delete selected items instead.
            </span>
          </span>
        </label>

        {hardDelete && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangleIcon className="size-4 shrink-0" />
            Hard delete is irreversible.
          </p>
        )}

        {cleanupMutation.error && (
          <p className="text-sm text-destructive" role="alert">
            {cleanupMutation.error.message}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={cleanupMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant={hardDelete ? "destructive" : "default"}
            disabled={cleanupMutation.isPending || count === 0}
            onClick={() => void handleConfirm()}
          >
            {cleanupMutation.isPending
              ? "Processing…"
              : hardDelete
                ? "Delete permanently"
                : "Retire items"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
