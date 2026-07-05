"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ImageIcon,
  MoreVerticalIcon,
  StarIcon,
  Trash2Icon,
  UploadIcon,
  ZoomInIcon,
} from "lucide-react";

import { ItemImage } from "@/features/inventory/components/item-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  useDeleteItemImageMutation,
  useItemImages,
  useSetPrimaryImageMutation,
  useUploadItemImageMutation,
} from "@/features/inventory/hooks";
import {
  buildItemImageAltText,
  IMAGE_TYPE_OPTIONS,
} from "@/features/inventory/services/images.service";
import { ImageCard } from "@/shared/ui";
import { cn } from "@/lib/utils";
import { formatEnumLabel, type ImageType } from "@/types/wardrobe";

function ImageTypeBadge({ type }: { type: ImageType | null }) {
  if (!type) {
    return null;
  }
  return (
    <Badge variant="secondary" className="capitalize">
      {formatEnumLabel(type)}
    </Badge>
  );
}

function GalleryPlaceholder() {
  return (
    <ImageCard>
      <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <ImageIcon className="size-10 opacity-60" />
        <span className="text-sm">No images yet</span>
      </div>
    </ImageCard>
  );
}

type ItemImageGalleryProps = {
  itemId: string;
  itemName: string;
  /** Overlay nodes (e.g. hero badge, favorite button) on the primary image. */
  overlay?: ReactNode;
};

export function ItemImageGallery({
  itemId,
  itemName,
  overlay,
}: ItemImageGalleryProps) {
  const imagesQuery = useItemImages(itemId);
  const uploadMutation = useUploadItemImageMutation(itemId);
  const setPrimaryMutation = useSetPrimaryImageMutation(itemId);
  const deleteMutation = useDeleteItemImageMutation(itemId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<ImageType>("product");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  const images = useMemo(() => imagesQuery.data ?? [], [imagesQuery.data]);
  const primary = images.find((image) => image.is_primary) ?? images[0] ?? null;
  const selected =
    images.find((image) => image.id === selectedId) ?? primary ?? null;

  const selectedTypeLabel = IMAGE_TYPE_OPTIONS.find(
    (option) => option.value === uploadType,
  )?.label;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    for (const file of Array.from(files)) {
      uploadMutation.mutate({ file, imageType: uploadType });
    }
  }

  return (
    <div className="space-y-4">
      {imagesQuery.isPending ? (
        <ImageCard>
          <div className="size-full animate-pulse bg-muted" />
        </ImageCard>
      ) : selected ? (
        <div className="relative">
          <ImageCard>
            <ItemImage
              src={selected.image_url}
              alt={buildItemImageAltText(itemName, "hero", selected.image_type)}
              containerClassName="size-full"
              className="size-full object-cover"
            />
          </ImageCard>
          {overlay}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <ImageTypeBadge type={selected.image_type} />
            {selected.is_primary ? (
              <Badge className="gap-1">
                <StarIcon className="size-3 fill-current" />
                Primary
              </Badge>
            ) : null}
          </div>
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute bottom-3 right-3 rounded-full shadow-sm"
            aria-label="Zoom image"
            onClick={() => setZoomOpen(true)}
          >
            <ZoomInIcon />
          </Button>
        </div>
      ) : (
        <GalleryPlaceholder />
      )}

      {images.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {images.map((image) => (
            <div key={image.id} className="group/thumb relative">
              <button
                type="button"
                aria-label={`View ${formatEnumLabel(image.image_type ?? "photo")} image`}
                aria-current={image.id === selected?.id}
                onClick={() => setSelectedId(image.id)}
                className={cn(
                  "block w-full overflow-hidden rounded-lg border bg-muted/30 outline-none ring-1 ring-foreground/5 transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  image.id === selected?.id && "ring-2 ring-primary",
                )}
              >
                <ItemImage
                  src={image.image_url}
                  alt={buildItemImageAltText(itemName, "gallery", image.image_type)}
                  containerClassName="aspect-square w-full"
                  className="aspect-square w-full object-cover"
                />
              </button>
              {image.is_primary ? (
                <Badge
                  variant="secondary"
                  className="absolute left-1 top-1 gap-0.5 px-1 py-0 text-[10px]"
                >
                  <StarIcon className="size-2.5 fill-current" />
                </Badge>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      className="absolute right-1 top-1 size-6 rounded-full opacity-0 shadow-sm transition-opacity group-hover/thumb:opacity-100 focus-visible:opacity-100"
                      aria-label="Image actions"
                    />
                  }
                >
                  <MoreVerticalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={image.is_primary || setPrimaryMutation.isPending}
                    onClick={() => setPrimaryMutation.mutate(image.id)}
                  >
                    <StarIcon />
                    Set as primary
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setImageToDelete(image.id)}
                  >
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      ) : null}

      {/* Upload */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Select
            value={uploadType}
            onValueChange={(value) => setUploadType(value as ImageType)}
          >
            <SelectTrigger className="w-36" aria-label="Image type">
              <span className="flex flex-1 truncate text-left">
                {selectedTypeLabel}
              </span>
            </SelectTrigger>
            <SelectContent>
              {IMAGE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="flex-1"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon />
            {uploadMutation.isPending ? "Uploading…" : "Upload images"}
          </Button>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring",
            isDragging && "border-primary bg-primary/5",
          )}
        >
          <UploadIcon className="size-5 opacity-70" />
          <span>
            Drag & drop or click to add {selectedTypeLabel?.toLowerCase()} images
          </span>
          <span className="text-xs">JPEG, PNG, WebP · up to 5 MB each</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
        />
      </div>

      {/* Zoom modal */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">
            {itemName} image preview
          </DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged view of the selected image.
          </DialogDescription>
          {selected ? (
            <ItemImage
              src={selected.image_url}
              alt={buildItemImageAltText(itemName, "preview", selected.image_type)}
              containerClassName="w-full"
              className="max-h-[80vh] w-full object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={imageToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setImageToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon className="text-muted-foreground" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the image from {itemName}. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (imageToDelete) {
                  deleteMutation.mutate(imageToDelete, {
                    onSettled: () => setImageToDelete(null),
                  });
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete image"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
