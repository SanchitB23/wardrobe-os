import type { Metadata } from "next";

import { ShoppingView } from "@/features/shopping/components";

export const metadata: Metadata = {
  title: "Shopping",
};

export default function ShoppingPage() {
  return <ShoppingView />;
}
