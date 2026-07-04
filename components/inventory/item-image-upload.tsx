"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ItemImage } from "@/components/inventory/item-image";
import {
  buildItemImageAltText,
  MAX_ITEM_IMAGE_SIZE_LABEL,
  validateItemImageFile,
} from "@/lib/wardrobe/images";
import { cn } from "@/lib/utils";

type ItemImageUploadProps = {
  itemName?: string;
  existingImageUrl?: string | null;
  disabled?: boolean;
  isUploading?: boolean;
  onFileChange: (file: File | null) => void;
  inputId?: string;
};

export function ItemImageUpload({
  itemName = "wardrobe item",
  existingImageUrl,
  disabled = false,
  isUploading = false,
  onFileChange,
  inputId = "item-image-upload",
}: ItemImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!selectedFile) {
      return null;
    }
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const displayUrl = previewUrl ?? existingImageUrl ?? null;
  const hasNewFile = selectedFile !== null;
  const previewAlt = buildItemImageAltText(itemName, "preview");
  const controlsDisabled = disabled || isUploading;

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setValidationError(null);

    if (!file) {
      return;
    }

    const validation = validateItemImageFile(file);
    if (!validation.valid) {
      toast.error(validation.message);
      setValidationError(validation.message);
      setSelectedFile(null);
      onFileChange(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    setSelectedFile(file);
    onFileChange(file);
  }

  function handleClear() {
    setSelectedFile(null);
    setValidationError(null);
    onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>Primary image</Label>
      <div
        className={cn(
          "flex flex-col gap-4 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center",
          controlsDisabled && "opacity-60",
          isUploading && "border-primary/40 bg-primary/5",
        )}
      >
        <div
          className={cn(
            "relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 shadow-sm ring-1 ring-foreground/5",
            !displayUrl && "border-dashed",
          )}
        >
          {displayUrl ? (
            <>
              <ItemImage
                src={displayUrl}
                alt={previewAlt}
                containerClassName="size-full"
                className="size-full object-cover"
              />
              {isUploading && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-[1px]"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2Icon className="size-6 animate-spin text-primary" />
                  <span className="text-xs font-medium">Uploading…</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="size-6" aria-hidden />
              <span className="text-xs">No image</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Upload one primary photo for this item. Images only, max{" "}
            {MAX_ITEM_IMAGE_SIZE_LABEL}. New uploads replace the current primary
            image.
          </p>
          {hasNewFile && selectedFile && (
            <p className="truncate text-sm font-medium">{selectedFile.name}</p>
          )}
          {!hasNewFile && existingImageUrl && (
            <p className="text-sm text-muted-foreground">
              Using current primary image. Choose a file to replace it.
            </p>
          )}
          {isUploading && (
            <p className="text-sm font-medium text-primary" role="status">
              Uploading image…
            </p>
          )}
          {validationError && (
            <p className="text-sm text-destructive" role="alert">
              {validationError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={controlsDisabled}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon />
              {displayUrl ? "Replace image" : "Upload image"}
            </Button>
            {(hasNewFile || previewUrl) && !isUploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={controlsDisabled}
                onClick={handleClear}
              >
                <XIcon />
                Clear selection
              </Button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        disabled={controlsDisabled}
        onChange={handleFileSelect}
      />
    </div>
  );
}
