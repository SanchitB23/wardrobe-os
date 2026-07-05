import type { QueryClient } from "@tanstack/react-query";

import { wardrobeKeys } from "@/shared/query/wardrobe-keys";

export async function invalidateWardrobeQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: wardrobeKeys.all });
}
