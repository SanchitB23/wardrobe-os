"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import dynamic from "next/dynamic";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemedToaster } from "@/features/layout/components/themed-toaster";

// Lazy: keeps cmdk + the Supabase-backed inventory query chain out of the shared
// First-Load JS on every route (RFC-009/H11). Still mounts for the Cmd+K hotkey.
const CommandPalette = dynamic(
  () => import("@/features/command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
          <CommandPalette />
          <ThemedToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
