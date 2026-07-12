"use client";

import {
  ActivityIcon,
  CalendarDaysIcon,
  CloudSunIcon,
  DatabaseIcon,
  FlagIcon,
  FlaskConicalIcon,
  GaugeIcon,
  ImagesIcon,
  NetworkIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  ShoppingBagIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";

import { PageHeader, useDevMode } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DevTool {
  title: string;
  description: string;
  icon: typeof WrenchIcon;
  href?: string;
  external?: boolean;
  status: "available" | "planned";
}

const TOOLS: DevTool[] = [
  {
    title: "AI Playground",
    description: "Run prompt builders in isolation; inspect prompt, response, validation, cache.",
    icon: FlaskConicalIcon,
    href: "/ai/playground",
    status: "available",
  },
  {
    title: "Weather Runtime",
    description: "Provider, cache hit/miss, latency, and the current WeatherSnapshot (RFC-011).",
    icon: CloudSunIcon,
    href: "/developer/weather",
    status: "available",
  },
  {
    title: "AI Runtime",
    description: "Capability routing, provider policies, latency + cost metrics, benchmarking (RFC-014).",
    icon: GaugeIcon,
    href: "/developer/ai-runtime",
    status: "available",
  },
  {
    title: "Observability",
    description:
      "Recent structured API / AI / engine log lines + request trace (RFC-022). Vercel Logs remain prod truth.",
    icon: ActivityIcon,
    href: "/developer/observability",
    status: "available",
  },
  {
    title: "Runtime Statistics",
    description: "Consolidated AI + Weather process metrics, fallbacks, and cache savings.",
    icon: GaugeIcon,
    href: "/developer/runtime-statistics",
    status: "available",
  },
  {
    title: "Execution Graph",
    description: "Intelligence Orchestrator capability DAG and recent engine_trace lines.",
    icon: NetworkIcon,
    href: "/developer/execution-graph",
    status: "available",
  },
  {
    title: "Feature Flags",
    description: "Read-only env flags for logging, AI, weather, and developer capture.",
    icon: FlagIcon,
    href: "/developer/feature-flags",
    status: "available",
  },
  {
    title: "Request Replay",
    description: "Sanitized API completion capture + GET replay (dev-only, no body storage).",
    icon: RefreshCwIcon,
    href: "/developer/replay",
    status: "available",
  },
  {
    title: "Acquisitions Intelligence",
    description:
      "Opportunity weights, need/ROI evolution, accuracy, lifecycle (RFC-018B).",
    icon: ShoppingBagIcon,
    href: "/developer/acquisitions",
    status: "available",
  },
  {
    title: "Inventory Image Backfill",
    description:
      "Batch-analyze primary photos into pending visual attributes (RFC-020). Accept still happens per item.",
    icon: ImagesIcon,
    href: "/developer/inventory-images",
    status: "available",
  },
  {
    title: "Wear Logs Runtime",
    description:
      "Wear source counts, combination frequency, and Save-as-Outfit promotion candidates (RFC-023).",
    icon: CalendarDaysIcon,
    href: "/developer/wear-logs",
    status: "available",
  },
  {
    title: "AI Test endpoint",
    description: "Raw /api/ai/test route for quick provider checks.",
    icon: TerminalIcon,
    href: "/api/ai/test",
    external: true,
    status: "available",
  },
  {
    title: "Prompt Viewer",
    description: "Inspect the exact system + user prompts sent for each builder.",
    icon: ScrollTextIcon,
    status: "planned",
  },
  {
    title: "Cache Viewer",
    description: "Browse the ai_cache (keys, TTLs, hit/miss).",
    icon: DatabaseIcon,
    status: "planned",
  },
];

export function DeveloperView() {
  const { devMode, toggle } = useDevMode();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Developer"
        badge={<Badge variant="secondary">Dev</Badge>}
        description="Internal tools for inspecting the AI runtime and orchestration. Hidden from normal navigation."
      />

      {!devMode ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <WrenchIcon className="size-6" />
            <p className="max-w-sm text-sm">
              Developer Mode is off. Enable it to surface these tools in the sidebar.
            </p>
            <Button size="sm" onClick={toggle}>Enable Developer Mode</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <Card key={tool.title} className={tool.status === "planned" ? "opacity-70" : undefined}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <tool.icon className="size-4" /> {tool.title}
                  </CardTitle>
                  {tool.status === "planned" ? (
                    <Badge variant="outline" className="text-[10px]">planned</Badge>
                  ) : null}
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {tool.href ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={tool.href}
                        aria-label={`Open ${tool.title}${tool.external ? " (opens in a new tab)" : ""}`}
                        {...(tool.external ? { target: "_blank", rel: "noreferrer" } : {})}
                      >
                        Open
                      </a>
                    }
                  />
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Coming soon
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
