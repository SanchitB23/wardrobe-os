"use client";

import { Trash2Icon } from "lucide-react";

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
import { useDeleteOutfitMutation } from "@/lib/wardrobe/hooks";
import type { OutfitListRow } from "@/types/wardrobe";

type DeleteOutfitDialogProps = {
  outfit: OutfitListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function DeleteOutfitDialog({
  outfit,
  open,
  onOpenChange,
  onDeleted,
}: DeleteOutfitDialogProps) {
  const deleteMutation = useDeleteOutfitMutation();

  async function handleDelete() {
    if (!outfit) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(outfit.id);
      onOpenChange(false);
      onDeleted?.();
    } catch {
      // Mutation onError shows toast.
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          deleteMutation.reset();
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon className="text-muted-foreground" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete outfit?</AlertDialogTitle>
          <AlertDialogDescription>
            {outfit ? (
              <>
                Remove{" "}
                <span className="font-medium text-foreground">{outfit.name}</span>{" "}
                and all of its slot assignments? This cannot be undone.
              </>
            ) : (
              "Remove this outfit?"
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteMutation.error ? (
          <p className="text-sm text-destructive" role="alert">
            {deleteMutation.error.message}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending || !outfit}
            onClick={() => void handleDelete()}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete outfit"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
