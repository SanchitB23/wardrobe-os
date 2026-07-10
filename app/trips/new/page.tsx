import type { Metadata } from "next";

import { TripFormView } from "@/features/trips/components";

export const metadata: Metadata = {
  title: "New trip",
};

export default function NewTripPage() {
  return <TripFormView />;
}
