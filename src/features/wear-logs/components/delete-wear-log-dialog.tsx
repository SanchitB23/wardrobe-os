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
import { useDeleteWearLogMutation } from "@/features/wear-logs/hooks";
import { formatWearLogDisplayDate } from "@/features/wear-logs/services/wear-logs.service";
import type { WearLogListRow } from "@/features/wear-logs/types";

type DeleteWearLogDialogProps = {
  log: WearLogListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteWearLogDialog({
  log,
  open,
  onOpenChange,
}: DeleteWearLogDialogProps) {
  const deleteMutation = useDeleteWearLogMutation();

  async function handleDelete() {
    if (!log) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(log.id);
      onOpenChange(false);
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
          <AlertDialogTitle>Delete wear log?</AlertDialogTitle>
          <AlertDialogDescription>
            {log ? (
              <>
                Remove the wear entry for{" "}
                <span className="font-medium text-foreground">
                  {log.item?.name ?? "this item"}
                </span>{" "}
                on{" "}
                <span className="font-medium text-foreground">
                  {formatWearLogDisplayDate(log.worn_on)}
                </span>
                ? This cannot be undone.
              </>
            ) : (
              "Remove this wear log entry?"
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteMutation.error && (
          <p className="text-sm text-destructive" role="alert">
            {deleteMutation.error.message}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending || !log}
            onClick={() => void handleDelete()}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete log"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
