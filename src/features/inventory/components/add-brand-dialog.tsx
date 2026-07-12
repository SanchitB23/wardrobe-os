"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateBrandMutation } from "@/features/inventory/hooks";

export function AddBrandDialog({
  open,
  defaultName,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  defaultName?: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (brandId: string) => void;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const createBrand = useCreateBrandMutation();

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const brand = await createBrand.mutateAsync(name);
      onCreated(brand.id);
      onOpenChange(false);
      setName("");
    } catch {
      // onError toast already shown; keep dialog + typed text for retry.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setName(defaultName ?? "");
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add new brand</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-brand-name">Brand name</Label>
          <Input
            id="new-brand-name"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="e.g. Uniqlo"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createBrand.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!name.trim() || createBrand.isPending}
          >
            {createBrand.isPending ? "Adding…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
