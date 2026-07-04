import { fetchItemImagesForItem, fetchPrimaryImageUrl } from "@/lib/wardrobe/images";
import { fetchWardrobeItemRelations } from "@/lib/wardrobe/relations";
import { fetchWardrobeItemById } from "@/lib/wardrobe/queries";
import {
  EMPTY_WARDROBE_ITEM_RELATIONS,
  type WardrobeItemDetail,
} from "@/types/wardrobe";

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
