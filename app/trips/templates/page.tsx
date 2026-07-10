import type { Metadata } from "next";

import { TripTemplatesView } from "@/features/trips/components";

export const metadata: Metadata = {
  title: "Trip templates",
};

export default function TripTemplatesPage() {
  return <TripTemplatesView />;
}
