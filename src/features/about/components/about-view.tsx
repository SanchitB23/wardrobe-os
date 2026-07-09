"use client";

import {
  BoxesIcon,
  ExternalLinkIcon,
  HeartIcon,
  LayersIcon,
  RocketIcon,
  SparklesIcon,
} from "lucide-react";

import pkg from "@/package.json";

import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Single source of truth: the version comes from package.json (RFC-009/N10).
const RELEASE = `v${pkg.version}`;
const REPO_URL = "https://github.com/sanchitbhatnagar/wardrobe-os";

const ENGINES = [
  "Inventory", "Outfit", "Analytics", "Recommendation", "Acquisition",
  "Vision", "Personalization", "Intelligence Orchestrator", "Lifestyle",
];

const AI_RUNTIME = [
  { capability: "Text", provider: "Gemini" },
  { capability: "Vision", provider: "Gemini" },
  { capability: "Explanations", provider: "Gemini" },
];

const CREDITS = [
  "Next.js (App Router)", "React", "TypeScript", "Supabase", "TanStack Query",
  "Base UI + Tailwind", "Google Gemini", "Open-Meteo",
];

const DOC_LINKS = [
  { label: "Architecture", href: "/ARCHITECTURE.md" },
  { label: "Engines", href: "/ENGINE.md" },
  { label: "Roadmap", href: "/ROADMAP.md" },
  { label: "Changelog", href: "/CHANGELOG.md" },
];

export function AboutView() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="About Wardrobe OS"
        badge={<Badge variant="secondary">{RELEASE}</Badge>}
        description="A deterministic wardrobe intelligence platform. Business logic owns decisions; AI explains; providers are interchangeable runtimes."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RocketIcon className="size-4" /> Release
          </CardTitle>
          <CardDescription>{RELEASE}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" render={<a href="/CHANGELOG.md">Release notes</a>} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayersIcon className="size-4" /> Architecture
          </CardTitle>
          <CardDescription>
            Deterministic domain engines are the source of truth; the Intelligence
            Orchestrator composes them; AI only explains and converses (ADR-005).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {ENGINES.map((e) => (
            <Badge key={e} variant="outline">{e}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SparklesIcon className="size-4" /> AI Runtime
          </CardTitle>
          <CardDescription>The current provider wiring (interchangeable).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {AI_RUNTIME.map((r) => (
            <div key={r.capability} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.capability}</span>
              <Badge variant="secondary">{r.provider}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartIcon className="size-4" /> Built with
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {CREDITS.map((c) => (
              <Badge key={c} variant="outline">{c}</Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BoxesIcon className="size-4" /> Links
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" render={<a href={REPO_URL} target="_blank" rel="noreferrer"><ExternalLinkIcon /> GitHub</a>} />
            {DOC_LINKS.map((d) => (
              <Button key={d.href} variant="outline" size="sm" render={<a href={d.href}>{d.label}</a>} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
