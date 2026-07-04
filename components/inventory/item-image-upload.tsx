"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, UploadIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ItemImageUploadProps = {
  existingImageUrl?: string | null;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
  inputId?: string;
};

export function ItemImageUpload({
  existingImageUrl,
  disabled = false,
  onFileChange,
  inputId = "item-image-upload",
}: ItemImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayUrl = previewUrl ?? existingImageUrl ?? null;
  const hasNewFile = selectedFile !== null;

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    onFileChange(file);
  }

  function handleClear() {
    setSelectedFile(null);
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
          disabled && "opacity-60",
        )}
      >
        <div
          className={cn(
            "relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40",
            !displayUrl && "border-dashed",
          )}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt="Item preview"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="size-6" />
              <span className="text-xs">No image</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Upload one primary photo for this item. New uploads replace the
            current primary image.
          </p>
          {hasNewFile && selectedFile && (
            <p className="truncate text-sm font-medium">{selectedFile.name}</p>
          )}
          {!hasNewFile && existingImageUrl && (
            <p className="text-sm text-muted-foreground">
              Using current primary image. Choose a file to replace it.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon />
              {displayUrl ? "Replace image" : "Upload image"}
            </Button>
            {(hasNewFile || previewUrl) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
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
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={handleFileSelect}
      />
    </div>
  );
}
