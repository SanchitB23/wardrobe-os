"use client";

import { useEffect, useState } from "react";
import {
  InfoIcon,
  LockIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  UserIcon,
  WrenchIcon,
} from "lucide-react";

import { PageHeader, ThemeToggle, useDevMode } from "@/features/layout";
import { LogoutButton } from "@/features/access/components/logout-button";
import { Badge } from "@/components/ui/badge";
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

const NAME_KEY = "wardrobeos:display-name";

/** AI runtime config (reflects the current provider wiring; interchangeable). */
const AI_RUNTIME: { capability: string; provider: string }[] = [
  { capability: "Text", provider: "Gemini" },
  { capability: "Vision", provider: "Gemini" },
  { capability: "Explanations", provider: "Gemini" },
];

function SettingRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

export function SettingsView() {
  const { devMode, toggle } = useDevMode();
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot local read
      setName(window.localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  function saveName(value: string) {
    setName(value);
    try {
      window.localStorage.setItem(NAME_KEY, value);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Settings"
        description="Your workspace, preferences, appearance, and developer tools."
      />

      <SettingRow
        icon={UserIcon}
        title="Profile"
        description="A single-user workspace. Your display name is used in greetings."
      >
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="display-name" className="text-xs text-muted-foreground">
            Display name
          </Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => saveName(e.target.value)}
            placeholder="Your name"
          />
        </div>
      </SettingRow>

      <SettingRow
        icon={SlidersHorizontalIcon}
        title="Preferences"
        description="What Wardrobe OS has learned about your taste — review, pin, or override."
      >
        <Button variant="outline" size="sm" render={<a href="/settings/preferences">Open Preferences</a>} />
      </SettingRow>

      <SettingRow
        icon={SparklesIcon}
        title="AI Runtime"
        description="AI explains and converses — it never decides. Providers are interchangeable."
      >
        <div className="space-y-1.5">
          {AI_RUNTIME.map((r) => (
            <div key={r.capability} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.capability}</span>
              <Badge variant="secondary">{r.provider}</Badge>
            </div>
          ))}
        </div>
      </SettingRow>

      <SettingRow icon={PaletteIcon} title="Appearance" description="Light, dark, or system theme.">
        <ThemeToggle />
      </SettingRow>

      <SettingRow
        icon={WrenchIcon}
        title="Developer Mode"
        description="Reveal developer tools (Playground, cache, execution graph) in the sidebar."
      >
        <Button variant={devMode ? "default" : "outline"} size="sm" onClick={toggle} aria-pressed={devMode}>
          Developer mode: {devMode ? "On" : "Off"}
        </Button>
      </SettingRow>

      <SettingRow
        icon={LockIcon}
        title="Access"
        description="This workspace can be gated behind a shared access code. Lock it to require the code again on this device."
      >
        <LogoutButton />
      </SettingRow>

      <SettingRow
        icon={InfoIcon}
        title="About"
        description="Version, architecture, provider, and release notes."
      >
        <Button variant="outline" size="sm" render={<a href="/about">Open About</a>} />
      </SettingRow>
    </div>
  );
}
