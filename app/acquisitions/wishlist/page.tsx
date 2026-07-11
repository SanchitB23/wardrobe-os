import type { Metadata } from "next";

import { WishlistView } from "@/features/shopping/components";

export const metadata: Metadata = {
  title: "Wishlist",
};

export default function AcquisitionsWishlistPage() {
  return <WishlistView />;
}
