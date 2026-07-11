import type { Metadata } from "next";

import { InventoryImageBackfillView } from "@/features/inventory/components/inventory-image-backfill-view";

export const metadata: Metadata = {
  title: "Inventory Image Backfill",
  robots: { index: false, follow: false },
};

export default function DeveloperInventoryImagesPage() {
  return <InventoryImageBackfillView />;
}
