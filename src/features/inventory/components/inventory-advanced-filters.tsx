"use client";

import { useState } from "react";
import { ChevronDownIcon, SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  FIT_TYPES,
  formatEnumLabel,
  FORMALITY_LEVELS,
  PURCHASE_STATUSES,
  type InventoryFilters,
  type LookupOption,
  type WardrobeImportLookups,
} from "@/types/wardrobe";

type FacetKey =
  | "seasonIds"
  | "styleIds"
  | "materialIds"
  | "featureIds"
  | "tagIds"
  | "occasionIds";

type InventoryAdvancedFiltersProps = {
  filters: InventoryFilters;
  lookups: WardrobeImportLookups;
  onChange: (filters: InventoryFilters) => void;
};

function MultiSelectFacet({
  label,
  selected,
  options,
  onToggle,
}: {
  label: string;
  selected: string[];
  options: LookupOption[];
  onToggle: (id: string) => void;
}) {
  const count = selected.length;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" className="w-full justify-between" />}
        >
          <span className={count ? undefined : "text-muted-foreground"}>
            {count ? `${count} selected` : `All ${label.toLowerCase()}`}
          </span>
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-auto">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No options
            </p>
          ) : (
            options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={selected.includes(option.id)}
                onCheckedChange={() => onToggle(option.id)}
              >
                {option.name}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TriStateSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? ""}
        onValueChange={(next) => onChange(next || undefined)}
      >
        <SelectTrigger className="w-full">
          <span className={value ? undefined : "text-muted-foreground"}>
            {options.find((o) => o.value === value)?.label ?? placeholder}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function InventoryAdvancedFilters({
  filters,
  lookups,
  onChange,
}: InventoryAdvancedFiltersProps) {
  const [open, setOpen] = useState(false);

  function toggleFacet(key: FacetKey, id: string) {
    const current = filters[key] ?? [];
    const next = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id];
    onChange({ ...filters, [key]: next.length > 0 ? next : undefined });
  }

  const facets: { key: FacetKey; label: string; options: LookupOption[] }[] = [
    { key: "seasonIds", label: "Seasons", options: lookups.seasons },
    { key: "styleIds", label: "Styles", options: lookups.styles },
    { key: "materialIds", label: "Materials", options: lookups.materials },
    { key: "featureIds", label: "Features", options: lookups.features },
    { key: "tagIds", label: "Tags", options: lookups.tags },
    { key: "occasionIds", label: "Occasions", options: lookups.occasions },
  ];

  return (
    <div className="rounded-xl border">
      <Button
        variant="ghost"
        className="w-full justify-between rounded-xl px-4 py-3"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex items-center gap-2 font-medium">
          <SlidersHorizontalIcon className="size-4" />
          Advanced filters
        </span>
        <ChevronDownIcon
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </Button>

      {open ? (
        <div className="grid gap-4 border-t p-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Formality</Label>
            <Select
              value={filters.formality ?? ""}
              onValueChange={(next) =>
                onChange({
                  ...filters,
                  formality: (next || undefined) as InventoryFilters["formality"],
                })
              }
            >
              <SelectTrigger className="w-full">
                <span className={filters.formality ? undefined : "text-muted-foreground"}>
                  {filters.formality
                    ? formatEnumLabel(filters.formality)
                    : "All formality levels"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All formality levels</SelectItem>
                {FORMALITY_LEVELS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {formatEnumLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Fit</Label>
            <Select
              value={filters.fit ?? ""}
              onValueChange={(next) =>
                onChange({
                  ...filters,
                  fit: (next || undefined) as InventoryFilters["fit"],
                })
              }
            >
              <SelectTrigger className="w-full">
                <span className={filters.fit ? undefined : "text-muted-foreground"}>
                  {filters.fit ? formatEnumLabel(filters.fit) : "All fits"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All fits</SelectItem>
                {FIT_TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {formatEnumLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Rating range</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={10}
                step={0.5}
                placeholder="Min"
                aria-label="Minimum rating"
                value={filters.ratingMin ?? ""}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    ratingMin: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                max={10}
                step={0.5}
                placeholder="Max"
                aria-label="Maximum rating"
                value={filters.ratingMax ?? ""}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    ratingMax: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>

          {facets.map((facet) => (
            <MultiSelectFacet
              key={facet.key}
              label={facet.label}
              selected={filters[facet.key] ?? []}
              options={facet.options}
              onToggle={(id) => toggleFacet(facet.key, id)}
            />
          ))}

          <TriStateSelect
            label="Image"
            value={
              filters.hasImage === undefined
                ? undefined
                : filters.hasImage
                  ? "has"
                  : "missing"
            }
            placeholder="Any"
            options={[
              { value: "has", label: "Has image" },
              { value: "missing", label: "Missing image" },
            ]}
            onChange={(value) =>
              onChange({
                ...filters,
                hasImage:
                  value === undefined ? undefined : value === "has",
              })
            }
          />

          <TriStateSelect
            label="Wear history"
            value={filters.wornStatus}
            placeholder="Any"
            options={[
              { value: "worn", label: "Worn" },
              { value: "never", label: "Never worn" },
            ]}
            onChange={(value) =>
              onChange({
                ...filters,
                wornStatus: value as InventoryFilters["wornStatus"],
              })
            }
          />

          <TriStateSelect
            label="Purchase status"
            value={filters.purchaseStatus}
            placeholder="Any"
            options={PURCHASE_STATUSES.map((status) => ({
              value: status,
              label: formatEnumLabel(status),
            }))}
            onChange={(value) =>
              onChange({
                ...filters,
                purchaseStatus: value as InventoryFilters["purchaseStatus"],
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
