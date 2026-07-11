"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  ScanSearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import type { ProspectiveItem } from "@/domain/acquisition";
import type {
  WishlistItem,
  WishlistPriority,
  WishlistStatus,
} from "@/features/shopping/types";
import {
  useAcquisitionsHub,
  useSaveWishlistMutation,
  useWishlist,
  useWishlistStatusMutation,
} from "@/features/shopping/hooks";
import { NeedEvolutionPanel } from "@/features/shopping/components/acquisitions-intelligence-panels";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const PRIORITIES: WishlistPriority[] = ["high", "medium", "low"];
const STATUSES: WishlistStatus[] = ["active", "purchased", "dismissed"];

type FormState = {
  name: string;
  category: string;
  color: string;
  price: string;
  notes: string;
  priority: WishlistPriority;
  status: WishlistStatus;
};

const emptyForm = (): FormState => ({
  name: "",
  category: "",
  color: "",
  price: "",
  notes: "",
  priority: "medium",
  status: "active",
});

function formFromItem(w: WishlistItem): FormState {
  return {
    name: w.item.name,
    category: w.item.category,
    color: w.item.color ?? "",
    price: w.item.estimatedPrice != null ? String(w.item.estimatedPrice) : "",
    notes: w.notes ?? "",
    priority: w.priority,
    status: w.status,
  };
}

function toSaveInput(form: FormState, id?: string) {
  const item: ProspectiveItem = {
    name: form.name.trim(),
    category: form.category.trim(),
    color: form.color.trim() || null,
    estimatedPrice: form.price ? Number(form.price) : null,
    notes: form.notes.trim() || null,
  };
  return {
    id,
    item,
    notes: form.notes.trim() || null,
    priority: form.priority,
    status: form.status,
  };
}

export function WishlistView() {
  const wishlist = useWishlist();
  const hub = useAcquisitionsHub();
  const save = useSaveWishlistMutation();
  const status = useWishlistStatusMutation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const items = wishlist.data ?? [];
  const active = items.filter((i) => i.status === "active");
  const archived = items.filter((i) => i.status !== "active");
  const opportunityById = new Map(
    (hub.data?.intelligence.opportunityQueue ?? []).map((o) => [o.id, o]),
  );
  const intelligence = hub.data?.intelligence;

  function startEdit(w: WishlistItem) {
    setEditingId(w.id);
    setForm(formFromItem(w));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function submit() {
    if (!form.name.trim() || !form.category.trim()) return;
    save.mutate(toSaveInput(form, editingId ?? undefined), {
      onSuccess: () => {
        setEditingId(null);
        setForm(emptyForm());
      },
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Wishlist"
        badge={<Badge variant="secondary">Acquisitions</Badge>}
        description="Capture items you’re considering. User priority stays yours; Opportunity Score (018B) shows learned ranking when available."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href="/acquisition/screenshot" />}
            >
              <ScanSearchIcon /> From screenshot
            </Button>
            <Button variant="outline" render={<Link href="/acquisitions" />}>
              Hub
            </Button>
          </div>
        }
      />

      <WishlistForm
        form={form}
        setForm={setForm}
        editingId={editingId}
        pending={save.isPending}
        onSubmit={submit}
        onCancel={editingId ? cancelEdit : undefined}
      />

      {wishlist.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" /> Loading…
          </CardContent>
        </Card>
      ) : null}

      {wishlist.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {wishlist.error.message ||
              "Couldn't load wishlist. Has the wishlist migration been applied?"}
          </CardContent>
        </Card>
      ) : null}

      {wishlist.data && items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Your wishlist is empty. Add an item above or capture one from a
            screenshot.
          </CardContent>
        </Card>
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-2">
          {active.map((w) => {
            const opp = opportunityById.get(w.id);
            return (
              <WishlistRow
                key={w.id}
                item={w}
                opportunityScore={opp?.opportunityScore ?? null}
                busy={status.isPending || save.isPending}
                onEdit={() => startEdit(w)}
                onPurchased={() =>
                  status.mutate({ id: w.id, action: "purchased" })
                }
                onDismiss={() =>
                  status.mutate({ id: w.id, action: "dismissed" })
                }
                onDelete={() => status.mutate({ id: w.id, action: "delete" })}
              />
            );
          })}
        </div>
      ) : null}

      {intelligence ? (
        <NeedEvolutionPanel intelligence={intelligence} />
      ) : null}

      {archived.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground/70">
            Purchased / dismissed
          </div>
          {archived.map((w) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground"
            >
              <span>
                {w.item.name}{" "}
                <Badge variant="outline" className="ml-1 capitalize">
                  {w.status}
                </Badge>
                <Badge variant="secondary" className="ml-1 capitalize">
                  {w.priority}
                </Badge>
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => startEdit(w)}>
                  <PencilIcon /> Edit
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete"
                  onClick={() => status.mutate({ id: w.id, action: "delete" })}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WishlistForm({
  form,
  setForm,
  editingId,
  pending,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  editingId: string | null;
  pending: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const nameId = useId();
  const catId = useId();
  const notesId = useId();
  const canSave =
    form.name.trim() !== "" && form.category.trim() !== "" && !pending;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {editingId ? "Edit wishlist item" : "Add to wishlist"}
        </CardTitle>
        <CardDescription>
          Name, category, notes, priority, and status. No scoring here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={nameId} className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input
              id={nameId}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Navy blazer"
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={catId} className="text-xs text-muted-foreground">
              Category
            </Label>
            <Input
              id={catId}
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
              placeholder="blazer"
              className="w-32"
            />
          </div>
          <Input
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            placeholder="Color"
            className="w-28"
            aria-label="Color"
          />
          <Input
            type="number"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            placeholder="Price"
            className="w-24"
            aria-label="Estimated price"
          />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  priority: (v ?? "medium") as WishlistPriority,
                }))
              }
            >
              <SelectTrigger className="w-28 capitalize">
                <span className="flex flex-1 text-left capitalize">
                  {form.priority}
                </span>
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  status: (v ?? "active") as WishlistStatus,
                }))
              }
            >
              <SelectTrigger className="w-32 capitalize">
                <span className="flex flex-1 text-left capitalize">
                  {form.status}
                </span>
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={notesId} className="text-xs text-muted-foreground">
            Notes
          </Label>
          <Textarea
            id={notesId}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Why you’re considering it…"
            className="min-h-16"
          />
        </div>
        <div className="flex gap-2">
          <Button disabled={!canSave} onClick={onSubmit}>
            {pending ? (
              <Loader2Icon className="animate-spin" />
            ) : editingId ? (
              <CheckIcon />
            ) : (
              <PlusIcon />
            )}
            {editingId ? "Save" : "Add"}
          </Button>
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function WishlistRow({
  item,
  opportunityScore,
  busy,
  onEdit,
  onPurchased,
  onDismiss,
  onDelete,
}: {
  item: WishlistItem;
  opportunityScore: number | null;
  busy: boolean;
  onEdit: () => void;
  onPurchased: () => void;
  onDismiss: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{item.item.name}</span>
            <Badge variant="secondary" className="capitalize">
              {item.priority}
            </Badge>
            {opportunityScore != null ? (
              <Badge variant="outline" className="tabular-nums">
                Opp {opportunityScore}
              </Badge>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            {[item.item.category, item.item.color].filter(Boolean).join(" · ")}
            {item.item.estimatedPrice != null
              ? ` · ${item.item.estimatedPrice}`
              : ""}
          </div>
          {item.notes ? (
            <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
          ) : null}
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onPurchased}
          >
            <CheckIcon /> Purchased
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDismiss}>
            <XIcon /> Dismiss
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onEdit}>
            <PencilIcon /> Edit
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
