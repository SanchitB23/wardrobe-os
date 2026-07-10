import { TripFormView } from "@/features/trips/components";

type EditTripPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTripPage({ params }: EditTripPageProps) {
  const { id } = await params;
  return <TripFormView tripId={id} />;
}
