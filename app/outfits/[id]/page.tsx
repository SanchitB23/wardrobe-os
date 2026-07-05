import { OutfitDetailView } from "@/features/outfits/components/outfit-detail-view";

type OutfitDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OutfitDetailPage({ params }: OutfitDetailPageProps) {
  const { id } = await params;

  return <OutfitDetailView outfitId={id} />;
}
