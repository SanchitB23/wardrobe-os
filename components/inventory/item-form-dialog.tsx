"use client";

import { useMemo, useState } from "react";

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

type ItemFormDialogBodyProps = Omit<ItemFormDialogProps, "open">;

function ItemFormDialogBody({
  mode,
  item,
  lookups,
  onOpenChange,
}: ItemFormDialogBodyProps) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(() =>
    isEdit && item ? itemToFormState(item) : EMPTY_ITEM_FORM,
  );
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

  const formForDisplay = useMemo(() => {
    if (
      form.subcategory_id &&
      !filteredSubcategories.some(
        (subcategory) => subcategory.id === form.subcategory_id,
      )
    ) {
      return { ...form, subcategory_id: null };
    }
    return form;
  }, [form, filteredSubcategories]);

  function handleFormChange(next: typeof form) {
    if (next.category_id !== form.category_id && next.subcategory_id) {
      const subcategoryStillValid = lookups.subcategories.some(
        (subcategory) =>
          subcategory.id === next.subcategory_id &&
          subcategory.category_id === next.category_id,
      );
      setForm(
        subcategoryStillValid
          ? next
          : { ...next, subcategory_id: null },
      );
      return;
    }

    setForm(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(null);

    if (!formForDisplay.code.trim() || !formForDisplay.name.trim()) {
      setValidationError("Code and name are required.");
      return;
    }

    try {
      const savedItem =
        isEdit && item
          ? await updateMutation.mutateAsync({
              id: item.id,
              ...formForDisplay,
            })
          : await createMutation.mutateAsync(formForDisplay);

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

  const mutationError =
    createMutation.error ??
    updateMutation.error ??
    uploadImageMutation.error;

  return (
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
          itemName={formForDisplay.name.trim() || item?.name || "wardrobe item"}
          existingImageUrl={isEdit ? item?.primary_image_url : null}
          disabled={submitting}
          isUploading={uploadImageMutation.isPending}
          onFileChange={setImageFile}
          inputId={isEdit ? "edit-item-image-upload" : "item-image-upload"}
        />

        <ItemFormFields
          form={formForDisplay}
          lookups={lookups}
          filteredSubcategories={filteredSubcategories}
          onChange={handleFormChange}
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
  );
}

export function ItemFormDialog({
  mode,
  open,
  item,
  lookups,
  onOpenChange,
}: ItemFormDialogProps) {
  const dialogKey = open ? `${mode}:${item?.id ?? "new"}` : "closed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ItemFormDialogBody
          key={dialogKey}
          mode={mode}
          item={item}
          lookups={lookups}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  );
}
