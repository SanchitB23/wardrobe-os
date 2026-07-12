"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  matchOccasionsToConcepts,
  suggestOccasionConcepts,
  type RelationSelections,
  type SuggestOccasionsInput,
} from "@/domain/inventory-relations";
import type { LookupOption } from "@/types/wardrobe";

type RelationLookups = {
  occasions: LookupOption[];
  materials: LookupOption[];
  seasons: LookupOption[];
};

type ItemRelationsFieldsProps = {
  selections: RelationSelections;
  lookups: RelationLookups;
  suggestInput: SuggestOccasionsInput;
  onChange: (next: RelationSelections) => void;
  disabled?: boolean;
};

function ChipGroup({
  label,
  options,
  selectedIds,
  onToggle,
  disabled,
  emptyHint,
  action,
}: {
  label: string;
  options: LookupOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  emptyHint: string;
  action?: React.ReactNode;
}) {
  const selected = new Set(selectedIds);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {action}
      </div>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => {
            const isSelected = selected.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(option.id)}
                aria-pressed={isSelected}
                className="disabled:opacity-50"
              >
                <Badge
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  {option.name}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function ItemRelationsFields({
  selections,
  lookups,
  suggestInput,
  onChange,
  disabled = false,
}: ItemRelationsFieldsProps) {
  function handleSuggest() {
    const concepts = suggestOccasionConcepts(suggestInput);
    const matches = matchOccasionsToConcepts(concepts, lookups.occasions);
    const merged = new Set([
      ...selections.occasionIds,
      ...matches.map((match) => match.id),
    ]);
    onChange({ ...selections, occasionIds: [...merged] });
  }

  return (
    <div className="space-y-4">
      <ChipGroup
        label="Occasions"
        options={lookups.occasions}
        selectedIds={selections.occasionIds}
        onToggle={(id) =>
          onChange({
            ...selections,
            occasionIds: toggleId(selections.occasionIds, id),
          })
        }
        disabled={disabled}
        emptyHint="No occasions in lookup — add rows via import."
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || lookups.occasions.length === 0}
            onClick={handleSuggest}
          >
            Suggest
          </Button>
        }
      />
      <ChipGroup
        label="Materials"
        options={lookups.materials}
        selectedIds={selections.materialIds}
        onToggle={(id) =>
          onChange({
            ...selections,
            materialIds: toggleId(selections.materialIds, id),
          })
        }
        disabled={disabled}
        emptyHint="No materials in lookup — add rows via import."
      />
      <ChipGroup
        label="Seasons"
        options={lookups.seasons}
        selectedIds={selections.seasonIds}
        onToggle={(id) =>
          onChange({
            ...selections,
            seasonIds: toggleId(selections.seasonIds, id),
          })
        }
        disabled={disabled}
        emptyHint="No seasons in lookup — add rows via import."
      />
    </div>
  );
}
