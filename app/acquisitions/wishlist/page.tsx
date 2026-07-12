import type { Metadata } from "next";
import { Suspense } from "react";

import { WishlistView } from "@/features/shopping/components";

export const metadata: Metadata = {
  title: "Wishlist",
};

export default function AcquisitionsWishlistPage() {
  return (
    <Suspense fallback={null}>
      <WishlistView />
    </Suspense>
  );
}
