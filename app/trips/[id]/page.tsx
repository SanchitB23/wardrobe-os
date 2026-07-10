import { TripDetailView } from "@/features/trips/components";

type TripDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;
  return <TripDetailView tripId={id} />;
}
