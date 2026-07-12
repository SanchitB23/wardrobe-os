"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import {
  buildInventoryDraftFromWishlist,
  convertWishlistToInventory,
} from "@/features/shopping/services/acquisitionPipeline.service";
import { selectWishlistById } from "@/features/shopping/repositories/shopping.repository";
import { fetchLookups } from "@/features/inventory/services/inventory.service";
import {
  EMPTY_ITEM_FORM,
  ItemFormFields,
  type ItemFormState,
} from "@/features/inventory/components/item-form-fields";
import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { wardrobeKeys } from "@/shared/query/wardrobe-keys";
import { unwrapData } from "@/shared/utils/data-result";
import type { FormalityEnum, WardrobeLookups } from "@/types/wardrobe";
import type { WishlistItem } from "@/features/shopping/types";

type Step = "edit" | "review" | "success";

type InventoryConversionWizardProps = {
  wishlistId: string;
};

type WizardBodyProps = {
  wishlist: WishlistItem;
  lookups: WardrobeLookups;
};

function WizardBody({ wishlist, lookups }: WizardBodyProps) {
  const queryClient = useQueryClient();
  const initial = buildInventoryDraftFromWishlist(wishlist, lookups);
  const [step, setStep] = useState<Step>("edit");
  const [form, setForm] = useState<ItemFormState>(() => ({
    ...EMPTY_ITEM_FORM,
    ...initial.form,
    formality: (initial.form.formality as FormalityEnum | null) ?? null,
  }));
  const [attachImage, setAttachImage] = useState(
    Boolean(wishlist.imageUrl || wishlist.imageStoragePath),
  );
  const [resultItemId, setResultItemId] = useState<string | null>(null);

  const filteredSubcategories = useMemo(() => {
    if (!form.category_id) return lookups.subcategories;
    return lookups.subcategories.filter(
      (subcategory) => subcategory.category_id === form.category_id,
    );
  }, [form.category_id, lookups.subcategories]);

  function handleFormChange(next: ItemFormState) {
    if (next.category_id !== form.category_id && next.subcategory_id) {
      const subcategoryStillValid = lookups.subcategories.some(
        (subcategory) =>
          subcategory.id === next.subcategory_id &&
          subcategory.category_id === next.category_id,
      );
      setForm(
        subcategoryStillValid ? next : { ...next, subcategory_id: null },
      );
      return;
    }
    setForm(next);
  }

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.code.trim()) {
        throw new Error("Code and name are required.");
      }
      return unwrapData(
        await convertWishlistToInventory({
          wishlistId: wishlist.id,
          draft: form,
          attachImage:
            attachImage &&
            Boolean(wishlist.imageUrl || wishlist.imageStoragePath),
          confirmed: true,
          purchasePrice: wishlist.purchasePrice ?? wishlist.item.estimatedPrice,
          purchaseDate: wishlist.purchaseDate,
        }),
      );
    },
    onSuccess: async (data) => {
      setResultItemId(data.itemId);
      setStep("success");
      await queryClient.invalidateQueries({ queryKey: wardrobeKeys.wishlist() });
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.acquisitionsHub(),
      });
      await queryClient.invalidateQueries({ queryKey: wardrobeKeys.all });
      toast.success("Inventory item created");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Conversion failed"),
  });

  if (step === "success" && resultItemId) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        <PageHeader
          title="Inventory created"
          badge={<Badge variant="secondary">RFC-018C</Badge>}
          description="Purchase linked. Optional next step: analyze Visual StyleDNA (Accept/Reject still required)."
        />
        <Card>
          <CardContent className="flex flex-wrap gap-3 py-6">
            <Button render={<Link href={`/inventory/${resultItemId}`} />}>
              View inventory item
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/inventory/${resultItemId}`} />}
            >
              Analyze Visual StyleDNA
            </Button>
            <Button
              variant="ghost"
              render={<Link href="/acquisitions/wishlist" />}
            >
              Back to wishlist
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Convert to inventory"
        badge={<Badge variant="secondary">RFC-018C</Badge>}
        description="Review and edit details before creating a wardrobe item. Nothing is inserted until you confirm."
        actions={
          <Button
            variant="outline"
            render={<Link href="/acquisitions/wishlist" />}
          >
            Cancel
          </Button>
        }
      />

      {step === "edit" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1 · Review item details</CardTitle>
            <CardDescription>
              Prefill from wishlist / Buy vs Skip. Manual edits win.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ItemFormFields
              form={form}
              lookups={lookups}
              filteredSubcategories={filteredSubcategories}
              onChange={handleFormChange}
            />
            {(wishlist.imageUrl || wishlist.imageStoragePath) && (
              <div className="flex items-start gap-3 rounded-lg border p-3">
                {wishlist.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={wishlist.imageUrl}
                    alt=""
                    className="size-16 rounded object-cover"
                  />
                ) : null}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="attach-image"
                    type="checkbox"
                    className="size-4"
                    checked={attachImage}
                    onChange={(e) => setAttachImage(e.target.checked)}
                  />
                  <Label htmlFor="attach-image">
                    Attach product image as primary inventory image
                  </Label>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setStep("review")}>
                Continue to review
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "review" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2 · Confirm create</CardTitle>
            <CardDescription>
              Required confirmation before insert. Duplicate conversion is
              blocked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Code</dt>
                <dd className="font-medium">{form.code}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{form.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Attach image</dt>
                <dd className="font-medium">{attachImage ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Purchase</dt>
                <dd className="font-medium">
                  {wishlist.purchasePrice ??
                    wishlist.item.estimatedPrice ??
                    "—"}{" "}
                  · {wishlist.purchaseDate ?? "today"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("edit")}
                disabled={convertMutation.isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
              >
                {convertMutation.isPending
                  ? "Creating…"
                  : "Confirm create inventory item"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function InventoryConversionWizard({
  wishlistId,
}: InventoryConversionWizardProps) {
  const lookupsQuery = useQuery({
    queryKey: wardrobeKeys.lookups(),
    queryFn: async () => unwrapData(await fetchLookups()),
  });

  const wishlistQuery = useQuery({
    queryKey: [...wardrobeKeys.wishlist(), wishlistId],
    queryFn: async () => unwrapData(await selectWishlistById(wishlistId)),
  });

  const wishlist = wishlistQuery.data;
  const lookups = lookupsQuery.data;

  if (wishlistQuery.isPending || lookupsQuery.isPending) {
    return (
      <div className="flex items-center gap-2 px-4 py-16 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" /> Loading conversion…
      </div>
    );
  }

  if (wishlistQuery.isError || !wishlist) {
    return (
      <div className="px-4 py-16 text-center text-sm text-destructive">
        {wishlistQuery.error?.message || "Wishlist item not found."}
      </div>
    );
  }

  if (wishlist.inventoryItemId) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
        <PageHeader
          title="Already converted"
          badge={<Badge variant="secondary">RFC-018C</Badge>}
          description="This wishlist item already has an inventory item."
        />
        <Button
          render={<Link href={`/inventory/${wishlist.inventoryItemId}`} />}
        >
          View inventory item
        </Button>
      </div>
    );
  }

  if (!lookups) {
    return (
      <div className="px-4 py-16 text-center text-sm text-destructive">
        Lookups unavailable.
      </div>
    );
  }

  return (
    <WizardBody
      key={wishlist.id}
      wishlist={wishlist}
      lookups={lookups}
    />
  );
}
