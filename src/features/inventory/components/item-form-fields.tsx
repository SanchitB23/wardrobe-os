"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddBrandDialog } from "@/features/inventory/components/add-brand-dialog";
import {
  FIT_TYPES,
  FORMALITY_LEVELS,
  formatEnumLabel,
  ITEM_STATUSES,
  OWNERSHIP_TYPES,
  USAGE_FREQUENCIES,
  type CreateWardrobeItemInput,
  type LookupOption,
  type SubcategoryOption,
  type WardrobeLookups,
} from "@/types/wardrobe";

const ADD_NEW_BRAND_VALUE = "__add_new__";

export type ItemFormState = CreateWardrobeItemInput;

type LookupSelectProps = {
  label: string;
  value: string | null | undefined;
  options: LookupOption[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  fallbackLabel?: string | null;
  onAddNew?: () => void;
};

function LookupSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "None",
  disabled = false,
  fallbackLabel,
  onAddNew,
}: LookupSelectProps) {
  const selectedLabel =
    options.find((option) => option.id === value)?.name ??
    fallbackLabel ??
    null;

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? ""}
        onValueChange={(next) => {
          if (next === ADD_NEW_BRAND_VALUE) {
            onAddNew?.();
            return; // do not change the field value
          }
          onChange(next ? next : null);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <span
            className={
              selectedLabel
                ? "flex flex-1 truncate text-left"
                : "flex flex-1 truncate text-left text-muted-foreground"
            }
          >
            {selectedLabel ?? placeholder}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">None</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
          {onAddNew ? (
            <SelectItem value={ADD_NEW_BRAND_VALUE}>
              ＋ Add new brand…
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}

type EnumSelectProps<T extends string> = {
  label: string;
  value: T | null | undefined;
  options: readonly T[];
  onChange: (value: T | null) => void;
  allowEmpty?: boolean;
};

function EnumSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  allowEmpty = false,
}: EnumSelectProps<T>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? ""}
        onValueChange={(next) => onChange(next ? (next as T) : null)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={allowEmpty ? "None" : "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value="">None</SelectItem>}
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

type ItemFormFieldsProps = {
  form: ItemFormState;
  lookups: WardrobeLookups;
  filteredSubcategories: SubcategoryOption[];
  onChange: (next: ItemFormState) => void;
  codeInputId?: string;
  nameInputId?: string;
  notesInputId?: string;
  ratingInputId?: string;
  labelFallbacks?: {
    category?: string | null;
    subcategory?: string | null;
    brand?: string | null;
    primary_color?: string | null;
  };
};

export function ItemFormFields({
  form,
  lookups,
  filteredSubcategories,
  onChange,
  codeInputId = "item-code",
  nameInputId = "item-name",
  notesInputId = "item-notes",
  ratingInputId = "item-rating",
  labelFallbacks,
}: ItemFormFieldsProps) {
  const [addBrandOpen, setAddBrandOpen] = useState(false);
  const brandSeed =
    lookups.brands.find((b) => b.id === form.brand_id)?.name ??
    labelFallbacks?.brand ??
    "";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={codeInputId}>Code</Label>
          <Input
            id={codeInputId}
            value={form.code}
            onChange={(event) =>
              onChange({ ...form, code: event.target.value })
            }
            placeholder="e.g. TOP-001"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={nameInputId}>Name</Label>
          <Input
            id={nameInputId}
            value={form.name}
            onChange={(event) =>
              onChange({ ...form, name: event.target.value })
            }
            placeholder="e.g. Navy Oxford Shirt"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LookupSelect
          label="Category"
          value={form.category_id}
          options={lookups.categories}
          fallbackLabel={labelFallbacks?.category}
          onChange={(category_id) => onChange({ ...form, category_id })}
        />
        <LookupSelect
          label="Subcategory"
          value={form.subcategory_id}
          options={filteredSubcategories}
          fallbackLabel={labelFallbacks?.subcategory}
          onChange={(subcategory_id) =>
            onChange({ ...form, subcategory_id })
          }
          disabled={!form.category_id && filteredSubcategories.length === 0}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LookupSelect
          label="Brand"
          value={form.brand_id}
          options={lookups.brands}
          fallbackLabel={labelFallbacks?.brand}
          onChange={(brand_id) => onChange({ ...form, brand_id })}
          onAddNew={() => setAddBrandOpen(true)}
        />
        <LookupSelect
          label="Primary color"
          value={form.primary_color_id}
          options={lookups.colors}
          fallbackLabel={labelFallbacks?.primary_color}
          onChange={(primary_color_id) =>
            onChange({ ...form, primary_color_id })
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <EnumSelect
          label="Status"
          value={form.status}
          options={ITEM_STATUSES}
          onChange={(status) => onChange({ ...form, status })}
        />
        <EnumSelect
          label="Ownership"
          value={form.ownership}
          options={OWNERSHIP_TYPES}
          onChange={(ownership) => onChange({ ...form, ownership })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <EnumSelect
          label="Fit"
          value={form.fit}
          options={FIT_TYPES}
          onChange={(fit) => onChange({ ...form, fit })}
        />
        <EnumSelect
          label="Formality"
          value={form.formality}
          options={FORMALITY_LEVELS}
          onChange={(formality) => onChange({ ...form, formality })}
          allowEmpty
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={ratingInputId}>Rating (0–10)</Label>
          <Input
            id={ratingInputId}
            type="number"
            min={0}
            max={10}
                step={0.1}
            value={form.rating ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              onChange({
                ...form,
                rating: raw === "" ? null : Number(raw),
              });
            }}
          />
        </div>
        <EnumSelect
          label="Usage"
          value={form.usage}
          options={USAGE_FREQUENCIES}
          onChange={(usage) => onChange({ ...form, usage })}
          allowEmpty
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={notesInputId}>Notes</Label>
        <Textarea
          id={notesInputId}
          value={form.notes ?? ""}
          onChange={(event) =>
            onChange({
              ...form,
              notes: event.target.value || null,
            })
          }
          placeholder="Optional notes…"
          rows={3}
        />
      </div>

      <AddBrandDialog
        open={addBrandOpen}
        defaultName={brandSeed}
        onOpenChange={setAddBrandOpen}
        onCreated={(brand_id) => onChange({ ...form, brand_id })}
      />
    </div>
  );
}

export const EMPTY_ITEM_FORM: ItemFormState = {
  code: "",
  name: "",
  category_id: null,
  subcategory_id: null,
  brand_id: null,
  primary_color_id: null,
  status: "active",
  ownership: "owned",
  fit: "unknown",
  formality: null,
  rating: null,
  usage: null,
  notes: null,
};

export function itemToFormState(item: {
  code: string;
  name: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  brand_id?: string | null;
  primary_color_id?: string | null;
  category?: LookupOption | null;
  subcategory?: LookupOption | null;
  brand?: LookupOption | null;
  primary_color?: LookupOption | null;
  status: ItemFormState["status"];
  ownership: ItemFormState["ownership"];
  fit: ItemFormState["fit"];
  formality: ItemFormState["formality"];
  rating: number | null;
  usage: ItemFormState["usage"];
  notes: string | null;
}): ItemFormState {
  return {
    code: item.code,
    name: item.name,
    category_id: item.category_id ?? item.category?.id ?? null,
    subcategory_id: item.subcategory_id ?? item.subcategory?.id ?? null,
    brand_id: item.brand_id ?? item.brand?.id ?? null,
    primary_color_id: item.primary_color_id ?? item.primary_color?.id ?? null,
    status: item.status ?? "active",
    ownership: item.ownership ?? "owned",
    fit: item.fit ?? "unknown",
    formality: item.formality,
    rating: item.rating,
    usage: item.usage,
    notes: item.notes,
  };
}
