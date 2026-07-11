"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2Icon, UploadIcon } from "lucide-react";

import { useVisionScanMutation } from "@/features/vision/hooks";
import type { VisionScanMode } from "@/features/vision/types";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export function VisionScanView() {
  const params = useSearchParams();
  const initial = params.get("mode") === "outfit" ? "outfit" : "closet";
  const [mode, setMode] = useState<VisionScanMode>(initial);
  const [file, setFile] = useState<File | null>(null);
  const scan = useVisionScanMutation();
  const fileId = useId();

  const canRun = Boolean(file) && !scan.isPending;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Vision Scan"
        badge={<Badge variant="secondary">Vision</Badge>}
        description="Upload a closet photo or outfit selfie. The Vision Engine detects garments; Intelligence builds a review queue. Nothing is written until you confirm."
        actions={
          <Button variant="outline" render={<Link href="/vision" />}>
            Hub
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Upload</CardTitle>
          <CardDescription>Reuses the RFC-002 Vision Engine endpoint.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode((v ?? "closet") as VisionScanMode)}
              >
                <SelectTrigger className="w-44">
                  <span className="flex flex-1 text-left capitalize">
                    {mode === "closet" ? "Closet scan" : "Outfit recognition"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closet">Closet scan</SelectItem>
                  <SelectItem value="outfit">Outfit recognition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={fileId} className="text-xs text-muted-foreground">
                Image
              </Label>
              <input
                id={fileId}
                type="file"
                accept="image/*"
                className="block w-full max-w-xs text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              disabled={!canRun}
              onClick={() => {
                if (!file) return;
                scan.mutate(
                  { file, mode },
                  {
                    onSuccess: () => {
                      window.location.href = "/vision/review";
                    },
                  },
                );
              }}
            >
              {scan.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <UploadIcon />
              )}
              Run scan
            </Button>
          </div>
          {scan.isError ? (
            <p className="text-sm text-destructive">{scan.error.message}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
