import type { Metadata } from "next";

import { UnlockView } from "@/features/access/components/unlock-view";

export const metadata: Metadata = {
  title: "Unlock",
  robots: { index: false, follow: false },
};

/** Only allow same-origin absolute paths as the post-unlock destination. */
function safeNext(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/";
}

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  return <UnlockView next={safeNext(params.next)} />;
}
