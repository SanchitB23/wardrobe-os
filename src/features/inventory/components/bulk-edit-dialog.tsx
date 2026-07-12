"use client";

import { useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  createDefaultBulkEditAction,
  describeBulkEditAction,
  isBulkEditActionReady,
} from "@/features/inventory/services/bulk-actions.service";
import { useBulkEditLookups, useBulkEditMutation } from "@/features/inventory/hooks";
import {
  BULK_EDIT_ACTION_OPTIONS,
  FIT_TYPES,
  FORMALITY_LEVELS,
  ITEM_STATUSES,
  USAGE_FREQUENCIES,
  formatEnumLabel,
  type BulkEditAction,
  type BulkEditLookups,
  type FormalityEnum,
  type LookupOption,
} from "@/types/wardrobe";

type BulkEditDialogProps = {
  open: boolean;
  itemIds: string[];
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

function LookupSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: LookupOption[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.id === value)?.name;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) {
            onChange(next);
          }
        }}
      >
        <SelectTrigger className="w-full">
          <span
            className={
              selectedLabel ? "truncate" : "truncate text-muted-foreground"
            }
          >
            {selectedLabel ?? placeholder}
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EnumSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => next && onChange(next as T)}>
        <SelectTrigger className="w-full">
          <span className="truncate">{formatEnumLabel(value)}</span>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {formatEnumLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ActionValueFields({
  action,
  lookups,
  onChange,
}: {
  action: BulkEditAction;
  lookups: BulkEditLookups;
  onChange: (action: BulkEditAction) => void;
}) {
  switch (action.type) {
    case "set_status":
      return (
        <EnumSelect
          label="Status"
          value={action.value}
          options={ITEM_STATUSES}
          onChange={(value) => onChange({ type: "set_status", value })}
        />
      );
    case "set_usage":
      return (
        <EnumSelect
          label="Usage"
          value={action.value}
          options={USAGE_FREQUENCIES}
          onChange={(value) => onChange({ type: "set_usage", value })}
        />
      );
    case "set_formality":
      return (
        <div className="space-y-2">
          <Label>Formality</Label>
          <Select
            value={action.value ?? "__clear__"}
            onValueChange={(next) =>
              onChange({
                type: "set_formality",
                value: next === "__clear__" ? null : (next as FormalityEnum),
              })
            }
          >
            <SelectTrigger className="w-full">
              <span className="truncate">
                {action.value ? formatEnumLabel(action.value) : "Clear formality"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__clear__">Clear formality</SelectItem>
              {FORMALITY_LEVELS.map((option) => (
                <SelectItem key={option} value={option}>
                  {formatEnumLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "set_fit":
      return (
        <EnumSelect
          label="Fit"
          value={action.value}
          options={FIT_TYPES}
          onChange={(value) => onChange({ type: "set_fit", value })}
        />
      );
    case "set_favorite":
      return (
        <div className="space-y-2">
          <Label>Favorite</Label>
          <Select
            value={action.value ? "true" : "false"}
            onValueChange={(next) =>
              onChange({ type: "set_favorite", value: next === "true" })
            }
          >
            <SelectTrigger className="w-full">
              <span className="truncate">
                {action.value ? "Mark as favorite" : "Remove favorite"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Mark as favorite</SelectItem>
              <SelectItem value="false">Remove favorite</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    case "add_tag":
    case "remove_tag":
      return (
        <LookupSelect
          label="Tag"
          value={action.tagId}
          options={lookups.tags}
          placeholder="Select a tag"
          onChange={(tagId) => onChange({ type: action.type, tagId })}
        />
      );
    case "add_season":
    case "remove_season":
      return (
        <LookupSelect
          label="Season"
          value={action.seasonId}
          options={lookups.seasons}
          placeholder="Select a season"
          onChange={(seasonId) => onChange({ type: action.type, seasonId })}
        />
      );
    case "add_style":
    case "remove_style":
      return (
        <LookupSelect
          label="Style"
          value={action.styleId}
          options={lookups.styles}
          placeholder="Select a style"
          onChange={(styleId) => onChange({ type: action.type, styleId })}
        />
      );
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function BulkEditDialog({
  open,
  itemIds,
  onOpenChange,
  onCompleted,
}: BulkEditDialogProps) {
  const [actionType, setActionType] = useState<BulkEditAction["type"]>("set_status");
  const [action, setAction] = useState<BulkEditAction>(
    createDefaultBulkEditAction("set_status"),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const lookupsQuery = useBulkEditLookups();
  const bulkEditMutation = useBulkEditMutation();

  const lookups = useMemo(
    () =>
      lookupsQuery.data ?? {
        tags: [],
        seasons: [],
        styles: [],
        occasions: [],
        materials: [],
      },
    [lookupsQuery.data],
  );
  const itemCount = itemIds.length;

  const actionSummary = useMemo(
    () => describeBulkEditAction(action, lookups),
    [action, lookups],
  );

  const canApply = isBulkEditActionReady(action) && itemCount > 0;

  function resetDialogState() {
    setActionType("set_status");
    setAction(createDefaultBulkEditAction("set_status"));
    setConfirmOpen(false);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDialogState();
    }
    onOpenChange(nextOpen);
  }

  function handleActionTypeChange(type: BulkEditAction["type"]) {
    setActionType(type);
    setAction(createDefaultBulkEditAction(type));
  }

  async function handleConfirm() {
    if (!canApply) {
      return;
    }

    try {
      await bulkEditMutation.mutateAsync({ itemIds, action });
      setConfirmOpen(false);
      resetDialogState();
      onOpenChange(false);
      onCompleted?.();
    } catch {
      setConfirmOpen(false);
      // Mutation onError shows toast.
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk edit</DialogTitle>
            <DialogDescription>
              Apply a change to {itemCount} selected item
              {itemCount === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={actionType}
                onValueChange={(next) =>
                  handleActionTypeChange(next as BulkEditAction["type"])
                }
              >
                <SelectTrigger className="w-full">
                  <span className="truncate">
                    {BULK_EDIT_ACTION_OPTIONS.find(
                      (option) => option.type === actionType,
                    )?.label ?? "Select action"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {BULK_EDIT_ACTION_OPTIONS.map((option) => (
                    <SelectItem key={option.type} value={option.type}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {lookupsQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading options…</p>
            ) : lookupsQuery.error ? (
              <p className="text-sm text-destructive" role="alert">
                {lookupsQuery.error.message}
              </p>
            ) : (
              <ActionValueFields
                action={action}
                lookups={lookups}
                onChange={setAction}
              />
            )}

            {canApply && (
              <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                {actionSummary} for {itemCount} item
                {itemCount === 1 ? "" : "s"}.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canApply || lookupsQuery.isPending || bulkEditMutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              Review & apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm bulk edit</AlertDialogTitle>
            <AlertDialogDescription>
              Apply <span className="font-medium text-foreground">{actionSummary}</span>{" "}
              to {itemCount} selected item{itemCount === 1 ? "" : "s"}? This cannot be
              undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkEditMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              disabled={bulkEditMutation.isPending}
              onClick={() => void handleConfirm()}
            >
              {bulkEditMutation.isPending ? "Applying…" : "Apply changes"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
