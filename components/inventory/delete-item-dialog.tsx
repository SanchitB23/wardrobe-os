"use client";

import { ArchiveIcon } from "lucide-react";

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
import { useRetireWardrobeItemMutation } from "@/lib/wardrobe/hooks";
import type { WardrobeItemRow } from "@/types/wardrobe";

type DeleteItemDialogProps = {
  item: WardrobeItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteItemDialog({
  item,
  open,
  onOpenChange,
}: DeleteItemDialogProps) {
  const retireMutation = useRetireWardrobeItemMutation();
  const alreadyRetired = item?.status === "retired";

  async function handleRetire() {
    if (!item || alreadyRetired) {
      return;
    }

    try {
      await retireMutation.mutateAsync({ id: item.id, name: item.name });
      onOpenChange(false);
    } catch {
      // Mutation onError shows toast; keep dialog open for retry.
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          retireMutation.reset();
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ArchiveIcon className="text-muted-foreground" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {alreadyRetired ? "Item already retired" : "Retire this item?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {item ? (
              alreadyRetired ? (
                <>
                  <span className="font-medium text-foreground">{item.name}</span>{" "}
                  is already marked as retired.
                </>
              ) : (
                <>
                  Mark{" "}
                  <span className="font-medium text-foreground">{item.name}</span>{" "}
                  (<span className="font-mono text-xs">{item.code}</span>) as
                  retired? The item stays in your catalog but is removed from
                  active rotation.
                </>
              )
            ) : (
              "Mark this item as retired?"
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {retireMutation.error && (
          <p className="text-sm text-destructive" role="alert">
            {retireMutation.error.message}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={retireMutation.isPending}>
            {alreadyRetired ? "Close" : "Cancel"}
          </AlertDialogCancel>
          {!alreadyRetired && (
            <Button
              variant="destructive"
              disabled={retireMutation.isPending || !item}
              onClick={() => void handleRetire()}
            >
              {retireMutation.isPending ? "Retiring…" : "Retire item"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
