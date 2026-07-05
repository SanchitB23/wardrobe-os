import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { FormalityEnum, ItemStatus } from "@/types/wardrobe";

const HEALTH_ITEM_SELECT = `
  id,
  name,
  formality,
  status,
  category:categories(name),
  brand:brands(name),
  primary_color:colors!wardrobe_items_primary_color_id_fkey(name)
`;

export type HealthItemRow = {
  id: string;
  name: string;
  formality: FormalityEnum | null;
  status: ItemStatus | null;
  category: { name: string } | null;
  brand: { name: string } | null;
  primary_color: { name: string } | null;
};

/** Fetches active wardrobe items with the fields the health engine consumes. */
export async function selectActiveHealthItems(): Promise<{
  data: HealthItemRow[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select(HEALTH_ITEM_SELECT)
    .eq("status", "active")
    .order("name");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as unknown as HealthItemRow[], error: null };
}
