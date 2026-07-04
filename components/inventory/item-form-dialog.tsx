"use client";

import { useEffect, useMemo, useState } from "react";

import {
  EMPTY_ITEM_FORM,
  ItemFormFields,
  itemToFormState,
} from "@/components/inventory/item-form-fields";
import { ItemImageUpload } from "@/components/inventory/item-image-upload";
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
  useCreateWardrobeItemMutation,
  useUpdateWardrobeItemMutation,
  useUploadPrimaryItemImageMutation,
} from "@/lib/wardrobe/hooks";
import type { WardrobeItemRow, WardrobeLookups } from "@/types/wardrobe";

type ItemFormDialogProps = {
  mode: "create" | "edit";
  open: boolean;
  item?: WardrobeItemRow | null;
  lookups: WardrobeLookups;
  onOpenChange: (open: boolean) => void;
};

export function ItemFormDialog({
  mode,
  open,
  item,
  lookups,
  onOpenChange,
}: ItemFormDialogProps) {
  const [form, setForm] = useState(EMPTY_ITEM_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const createMutation = useCreateWardrobeItemMutation();
  const updateMutation = useUpdateWardrobeItemMutation();
  const uploadImageMutation = useUploadPrimaryItemImageMutation();

  const submitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadImageMutation.isPending;

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
      setValidationError(null);
      setImageFile(null);
      createMutation.reset();
      updateMutation.reset();
      uploadImageMutation.reset();
      return;
    }

    if (mode === "edit" && item) {
      setForm(itemToFormState(item));
    } else {
      setForm(EMPTY_ITEM_FORM);
    }
    setImageFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog closes
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
    setValidationError(null);

    if (!form.code.trim() || !form.name.trim()) {
      setValidationError("Code and name are required.");
      return;
    }

    try {
      const savedItem =
        mode === "edit" && item
          ? await updateMutation.mutateAsync({ id: item.id, ...form })
          : await createMutation.mutateAsync(form);

      if (imageFile) {
        await uploadImageMutation.mutateAsync({
          itemId: savedItem.id,
          file: imageFile,
        });
      }

      onOpenChange(false);
    } catch {
      // Mutation onError shows toast; keep dialog open for retry.
    }
  }

  const isEdit = mode === "edit";
  const mutationError =
    createMutation.error ??
    updateMutation.error ??
    uploadImageMutation.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit wardrobe item" : "Add wardrobe item"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update item details and optionally replace the primary photo."
              : "Create a new item and optionally add a primary photo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ItemImageUpload
            existingImageUrl={isEdit ? item?.primary_image_url : null}
            disabled={submitting}
            onFileChange={setImageFile}
            inputId={isEdit ? "edit-item-image-upload" : "item-image-upload"}
          />

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
              {submitting
                ? uploadImageMutation.isPending
                  ? "Uploading image…"
                  : "Saving…"
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
