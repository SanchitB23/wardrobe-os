"use client";

import { useState } from "react";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";

import { BulkEditDialog } from "@/components/inventory/bulk-edit-dialog";
import { Button } from "@/components/ui/button";

type BulkActionsToolbarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  onCompleted?: () => void;
  selectedIds: string[];
};

export function BulkActionsToolbar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onCompleted,
}: BulkActionsToolbarProps) {
  const [editOpen, setEditOpen] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4 lg:px-8">
          <p className="text-sm font-medium">
            {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClearSelection}>
              <XIcon />
              Clear
            </Button>
            <Button onClick={() => setEditOpen(true)}>
              <SlidersHorizontalIcon />
              Bulk actions
            </Button>
          </div>
        </div>
      </div>

      <BulkEditDialog
        open={editOpen}
        itemIds={selectedIds}
        onOpenChange={setEditOpen}
        onCompleted={() => {
          onCompleted?.();
          onClearSelection();
        }}
      />
    </>
  );
}
