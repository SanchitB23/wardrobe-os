"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarPlusIcon,
  LightbulbIcon,
  MessagesSquareIcon,
  ShirtIcon,
  WandSparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const QUICK_ACTIONS = [
  { label: "View Recommendations", href: "/recommendations", icon: WandSparklesIcon },
  { label: "Open Inventory", href: "/inventory", icon: ShirtIcon },
  { label: "Log Wear", href: "/wear-logs", icon: CalendarPlusIcon },
] as const;

export function TodayView() {
  // Compute greeting + date on the client to respect the viewer's local time.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const hello = now ? greeting(now.getHours()) : "Welcome back";
  const dateLabel = now
    ? now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{hello}</h1>
        <p className="text-muted-foreground">
          {dateLabel ? `${dateLabel} — ` : ""}here&apos;s your wardrobe at a glance.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's recommendation */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <WandSparklesIcon className="size-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-base">Today&apos;s recommendation</CardTitle>
            </div>
            <CardDescription>
              Your ranked outfit picks — saved and freshly generated — live in the
              Recommendation Center.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-wrap gap-2">
            <Button render={<Link href="/recommendations" />}>
              <WandSparklesIcon />
              See today&apos;s picks
            </Button>
            <Button variant="outline" render={<Link href="/chat" />}>
              <MessagesSquareIcon />
              Ask the Stylist
            </Button>
          </CardContent>
        </Card>

        {/* Today's insight */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <LightbulbIcon className="size-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base">Today&apos;s insight</CardTitle>
            </div>
            <CardDescription>
              Wardrobe health, usage, and gaps are summarised in the Insight
              Center. A daily highlight will surface here soon.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/dashboard/insights" />}>
              <LightbulbIcon />
              Open Insight Center
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground/70">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-card p-4 text-sm font-medium outline-none transition-colors",
                  "hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4" />
                </span>
                {action.label}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
