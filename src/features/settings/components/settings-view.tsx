"use client";

import { SettingsIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/features/layout";

export function SettingsView() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Settings"
        description="Manage preferences for your Wardrobe OS workspace."
      />

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            Configuration options will live here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SettingsIcon />
              </EmptyMedia>
              <EmptyTitle>No settings yet</EmptyTitle>
              <EmptyDescription>
                This is a placeholder. Preferences, appearance, and data
                controls will be added here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </div>
  );
}
