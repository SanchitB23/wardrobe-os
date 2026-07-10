import type { Metadata } from "next";

import { TripsView } from "@/features/trips/components";

export const metadata: Metadata = {
  title: "Trips",
};

export default function TripsPage() {
  return <TripsView />;
}
