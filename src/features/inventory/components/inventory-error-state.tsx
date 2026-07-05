"use client";

import { ErrorState } from "@/shared/ui";

type InventoryErrorStateProps = {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
};

export function InventoryErrorState({
  message,
  onRetry,
  isRetrying = false,
}: InventoryErrorStateProps) {
  return (
    <ErrorState
      title="Unable to load inventory"
      message={message}
      onRetry={onRetry}
      isRetrying={isRetrying}
      hint={
        message.includes("row-level security")
          ? "RLS is enabled but policies may be missing. Add SELECT/INSERT/UPDATE/DELETE policies on inventory tables before this dashboard can read or write data."
          : undefined
      }
    />
  );
}
