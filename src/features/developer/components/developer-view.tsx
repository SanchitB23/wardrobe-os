"use client";

import {
  DatabaseIcon,
  FlagIcon,
  FlaskConicalIcon,
  GaugeIcon,
  NetworkIcon,
  ScrollTextIcon,
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
  {
    title: "Execution Graph",
    description: "Inspect an Intelligence Orchestrator ExecutionReport (order, timings, failures).",
    icon: NetworkIcon,
    status: "planned",
  },
  {
    title: "Runtime Statistics",
    description: "Provider selection, latency, and cost analytics.",
    icon: GaugeIcon,
    status: "planned",
  },
  {
    title: "Feature Flags",
    description: "Toggle experimental surfaces.",
    icon: FlagIcon,
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
