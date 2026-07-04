"use client";

import { useEffect, useMemo, useState } from "react";

import {
  EMPTY_ITEM_FORM,
  ItemFormFields,
  itemToFormState,
} from "@/components/inventory/item-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createWardrobeItem,
  updateWardrobeItem,
} from "@/lib/wardrobe/queries";
import type { WardrobeItemRow, WardrobeLookups } from "@/types/wardrobe";

type ItemFormDialogProps = {
  mode: "create" | "edit";
  open: boolean;
  item?: WardrobeItemRow | null;
  lookups: WardrobeLookups;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function ItemFormDialog({
  mode,
  open,
  item,
  lookups,
  onOpenChange,
  onSuccess,
}: ItemFormDialogProps) {
  const [form, setForm] = useState(EMPTY_ITEM_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredSubcategories = useMemo(() => {
    if (!form.category_id) {
      return lookups.subcategories;
    }
    return lookups.subcategories.filter(
      (subcategory) => subcategory.category_id === form.category_id,
    );
  }, [form.category_id, lookups.subcategories]);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_ITEM_FORM);
      setError(null);
      setSubmitting(false);
      return;
    }

    if (mode === "edit" && item) {
      setForm(itemToFormState(item));
    } else {
      setForm(EMPTY_ITEM_FORM);
    }
  }, [open, mode, item]);

  useEffect(() => {
    if (
      form.subcategory_id &&
      !filteredSubcategories.some(
        (subcategory) => subcategory.id === form.subcategory_id,
      )
    ) {
      setForm((current) => ({ ...current, subcategory_id: null }));
    }
  }, [filteredSubcategories, form.subcategory_id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.code.trim() || !form.name.trim()) {
      setError("Code and name are required.");
      return;
    }

    setSubmitting(true);

    const result =
      mode === "edit" && item
        ? await updateWardrobeItem({ id: item.id, ...form })
        : await createWardrobeItem(form);

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    onOpenChange(false);
    onSuccess();
  }

  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit wardrobe item" : "Add wardrobe item"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update item details. Lookup values come from your database tables."
              : "Create a new item in your inventory."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ItemFormFields
            form={form}
            lookups={lookups}
            filteredSubcategories={filteredSubcategories}
            onChange={setForm}
            labelFallbacks={
              isEdit && item
                ? {
                    category: item.category?.name,
                    subcategory: item.subcategory?.name,
                    brand: item.brand?.name,
                    primary_color: item.primary_color?.name,
                  }
                : undefined
            }
            codeInputId={isEdit ? "edit-item-code" : "item-code"}
            nameInputId={isEdit ? "edit-item-name" : "item-name"}
            notesInputId={isEdit ? "edit-item-notes" : "item-notes"}
            ratingInputId={isEdit ? "edit-item-rating" : "item-rating"}
          />

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
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
