"use client";

import Link from "next/link";
import {
  CameraIcon,
  ClipboardCheckIcon,
  ScanSearchIcon,
  ShirtIcon,
} from "lucide-react";

import { useVisionSession } from "@/features/vision/hooks";
import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function VisionHubView() {
  const session = useVisionSession();
  const pending = session.data?.queue.pendingCount ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Vision"
        badge={<Badge variant="secondary">Intelligence</Badge>}
        description="Practical Vision workflows — closet scan, assisted outfit recognition, and visual duplicate warnings. Vision detects; you confirm. Nothing is auto-added or auto-logged."
        actions={
          <Button render={<Link href="/vision/scan" />}>
            <CameraIcon /> Scan
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/vision/scan?mode=closet" className="block">
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ScanSearchIcon className="size-4" /> Closet Scan
              </CardTitle>
              <CardDescription>
                Bulk detect garments, compare to inventory, review before adding.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/vision/scan?mode=outfit" className="block">
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShirtIcon className="size-4" /> Outfit Recognition
              </CardTitle>
              <CardDescription>
                Mirror selfie → match inventory → confirm wear logs.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/vision/review" className="block">
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardCheckIcon className="size-4" /> Review Queue
                {pending > 0 ? (
                  <Badge variant="default" className="ml-1">
                    {pending}
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                Confirm or dismiss pending adds, wear logs, and duplicate flags.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
