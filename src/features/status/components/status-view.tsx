"use client";

import { ActivityIcon, CircuitBoardIcon, InfoIcon, WalletIcon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StatusModel } from "@/domain/status";

const SERVICE_LABELS: Record<string, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  supabase: "Supabase",
  open_meteo: "Open-Meteo",
};

const STATE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ok: "default",
  warn: "secondary",
  error: "destructive",
  unknown: "outline",
};

/** Read-only status view (RFC-028): AI wiring, service health, budget, build. */
export function StatusView({
  model,
  version,
  environment,
}: {
  model: StatusModel;
  version: string;
  environment: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Status"
        description="Live wiring and service health. Read-only."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircuitBoardIcon className="size-4" /> AI Wiring
          </CardTitle>
          <CardDescription>
            Capability routing read live from the runtime policy (RFC-014B).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {model.aiWiring.map((row) => (
            <div key={row.capability} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {row.capability}
                {row.override ? (
                  <Badge variant="outline" className="ml-2">override</Badge>
                ) : null}
              </span>
              <span className="flex items-center gap-1.5">
                <Badge variant="secondary">{row.primary}</Badge>
                <span className="text-xs text-muted-foreground">{row.model}</span>
                {row.fallback ? (
                  <span className="text-xs text-muted-foreground">→ {row.fallback}</span>
                ) : null}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ActivityIcon className="size-4" /> Service Health
          </CardTitle>
          <CardDescription>
            Passive signals — key presence and the most recent real call.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {model.services.map((service) => (
            <div key={service.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {SERVICE_LABELS[service.id] ?? service.id}
              </span>
              <span className="flex items-center gap-2">
                {service.lastCall ? (
                  <span className="text-xs text-muted-foreground">
                    last call {new Date(service.lastCall.at).toLocaleTimeString()}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">no recent calls</span>
                )}
                <Badge variant={STATE_VARIANT[service.state]}>{service.state}</Badge>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <WalletIcon className="size-4" /> OpenAI Budget
          </CardTitle>
          <CardDescription>Budget guard (RFC-014B).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Month to date</span>
            <span>${model.budget.spentUsd.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Soft alert / hard stop</span>
            <span>
              ${model.budget.softAlertUsd.toFixed(2)} / ${model.budget.hardStopUsd.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">State</span>
            <Badge
              variant={
                model.budget.state === "ok"
                  ? "default"
                  : model.budget.state === "soft_alert"
                    ? "secondary"
                    : "destructive"
              }
            >
              {model.budget.state.replace("_", " ")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <InfoIcon className="size-4" /> Build
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Version</span>
            <span>v{version}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Environment</span>
            <span>{environment}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
