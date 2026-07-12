import { InventoryConversionWizard } from "@/features/shopping/components/inventory-conversion-wizard";

type PageProps = {
  params: Promise<{ wishlistId: string }>;
};

export default async function ConvertWishlistPage({ params }: PageProps) {
  const { wishlistId } = await params;
  return <InventoryConversionWizard wishlistId={wishlistId} />;
}
