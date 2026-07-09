"use client";

import { useState } from "react";
import { Loader2Icon, LockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** "Lock app" — clears the access cookie and returns to /unlock (RFC-010). */
export function LogoutButton() {
  const [submitting, setSubmitting] = useState(false);

  async function logout() {
    setSubmitting(true);
    try {
      await fetch("/api/access/logout", { method: "POST" });
    } catch {
      /* ignore — navigate to /unlock regardless */
    }
    window.location.assign("/unlock");
  }

  return (
    <Button variant="outline" size="sm" onClick={logout} disabled={submitting}>
      {submitting ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
      Lock app
    </Button>
  );
}
