"use client";

import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <AlertCircleIcon className="size-4 text-destructive" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-base text-destructive">
              Unable to load inventory
            </CardTitle>
            <CardDescription className="text-destructive/80">
              {message}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {message.includes("row-level security") && (
          <p className="text-sm text-muted-foreground">
            RLS is enabled but policies may be missing. Add SELECT/INSERT/UPDATE/DELETE
            policies on inventory tables before this dashboard can read or write data.
          </p>
        )}
        <Button
          variant="outline"
          onClick={onRetry}
          disabled={isRetrying}
          className="bg-background"
        >
          <RefreshCwIcon className={isRetrying ? "animate-spin" : undefined} />
          {isRetrying ? "Retrying…" : "Try again"}
        </Button>
      </CardContent>
    </Card>
  );
}
