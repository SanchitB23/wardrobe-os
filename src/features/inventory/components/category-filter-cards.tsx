"use client";

import { cn } from "@/lib/utils";
import { UNCATEGORIZED_CATEGORY_ID, type CategoryCountsResult } from "@/types/wardrobe";

type CategoryFilterCardsProps = {
  counts: CategoryCountsResult;
  selectedCategoryId?: string;
  onSelect: (categoryId: string | undefined) => void;
};

type CategoryCardProps = {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
};

function CategoryCard({ label, count, selected, onClick }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[88px] flex-col justify-between rounded-xl border px-4 py-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <span className="text-sm font-medium leading-snug">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{count}</span>
    </button>
  );
}

export function CategoryFilterCards({
  counts,
  selectedCategoryId,
  onSelect,
}: CategoryFilterCardsProps) {
  const cards = [
    {
      id: undefined as string | undefined,
      label: "All items",
      count: counts.total,
    },
    ...counts.categories.map((category) => ({
      id: category.id,
      label: category.name,
      count: category.count,
    })),
  ];

  if (counts.uncategorized > 0) {
    cards.push({
      id: UNCATEGORIZED_CATEGORY_ID,
      label: "Uncategorized",
      count: counts.uncategorized,
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {cards.map((card) => (
        <CategoryCard
          key={card.id ?? "all"}
          label={card.label}
          count={card.count}
          selected={
            card.id === UNCATEGORIZED_CATEGORY_ID
              ? selectedCategoryId === UNCATEGORIZED_CATEGORY_ID
              : card.id === selectedCategoryId ||
                (card.id === undefined && !selectedCategoryId)
          }
          onClick={() => onSelect(card.id)}
        />
      ))}
    </div>
  );
}
