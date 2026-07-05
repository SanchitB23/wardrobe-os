import { fetchWardrobeItemById } from "@/features/inventory/services/inventory.service";
import {
  fetchItemImagesForItem,
  fetchPrimaryImageUrl,
} from "@/features/inventory/services/images.service";
import { fetchWardrobeItemRelations } from "@/features/inventory/services/relations.service";
import {
  EMPTY_WARDROBE_ITEM_RELATIONS,
  type WardrobeItemDetail,
} from "@/features/inventory/types";

export async function fetchWardrobeItemDetail(
  itemId: string,
): Promise<{ data: WardrobeItemDetail | null; error: Error | null }> {
  const itemResult = await fetchWardrobeItemById(itemId);

  if (itemResult.error) {
    return { data: null, error: itemResult.error };
  }

  if (!itemResult.data) {
    return { data: null, error: null };
  }

  const [primaryResult, imagesResult, relationsResult] = await Promise.all([
    fetchPrimaryImageUrl(itemId),
    fetchItemImagesForItem(itemId),
    fetchWardrobeItemRelations(itemId),
  ]);

  const firstError =
    primaryResult.error ?? imagesResult.error ?? relationsResult.error;

  if (firstError) {
    return { data: null, error: firstError };
  }

  return {
    data: {
      item: {
        ...itemResult.data,
        primary_image_url: primaryResult.data,
      },
      images: imagesResult.data ?? [],
      relations: relationsResult.data ?? EMPTY_WARDROBE_ITEM_RELATIONS,
    },
    error: null,
  };
}
