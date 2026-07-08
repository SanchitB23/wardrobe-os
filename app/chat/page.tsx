import { Suspense } from "react";
import type { Metadata } from "next";

import { ChatView } from "@/features/chat/components/chat-view";

export const metadata: Metadata = {
  title: "AI Stylist",
};

export default function ChatPage() {
  // ChatView reads `?q=` (useSearchParams) → needs a Suspense boundary.
  return (
    <Suspense>
      <ChatView />
    </Suspense>
  );
}
