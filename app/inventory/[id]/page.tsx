import { ItemDetailView } from "@/components/inventory/item-detail-view";

type ItemDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { id } = await params;

  return <ItemDetailView itemId={id} />;
}
