"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/** Sonner toaster that follows the active next-themes theme. */
export function ThemedToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={(theme as "light" | "dark" | "system") ?? "system"}
      richColors
      closeButton
      position="top-right"
    />
  );
}
