import type { Metadata } from "next";

import { LifestyleTripView } from "@/features/lifestyle/components/LifestyleTripView";

export const metadata: Metadata = {
  title: "Trip Planner",
};

export default function LifestyleTripPage() {
  return <LifestyleTripView />;
}
