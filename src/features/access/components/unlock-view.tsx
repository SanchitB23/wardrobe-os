"use client";

import { useState } from "react";
import { LockIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UnlockView({ next }: { next: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const response = await fetch("/api/access/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (response.ok) {
        // Full navigation so the proxy re-runs with the fresh cookie.
        window.location.assign(next);
        return;
      }
      setError(true);
      setSubmitting(false);
    } catch {
      setError(true);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
            <LockIcon className="size-5 text-muted-foreground" />
          </div>
          <CardTitle>Wardrobe OS</CardTitle>
          <CardDescription>Enter the access code to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="access-code" className="text-xs text-muted-foreground">
                Access code
              </Label>
              <Input
                id="access-code"
                type="password"
                autoComplete="off"
                autoFocus
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  if (error) setError(false);
                }}
                aria-invalid={error}
                aria-describedby={error ? "access-error" : undefined}
              />
              {error ? (
                <p id="access-error" role="alert" className="text-xs text-destructive">
                  Incorrect code.
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={submitting || !code.trim()}>
              {submitting ? <Loader2Icon className="animate-spin" /> : null}
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
