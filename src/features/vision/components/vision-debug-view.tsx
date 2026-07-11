"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Loader2Icon, UploadIcon } from "lucide-react";

import { analyzeVisionFile, debugVisionIntelligence } from "@/features/vision/services/vision.service";
import { saveVisionSession } from "@/features/vision/session";
import type { VisionScanSession } from "@/features/vision/types";
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

/**
 * Developer Mode Vision Debug — raw VisionAnalysis + Intelligence scores.
 * Not a primary user surface.
 */
export function VisionDebugView() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<VisionScanSession | null>(null);
  const fileId = useId();

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const analysisResult = await analyzeVisionFile({
        file,
        source: "closet_photo",
      });
      if (analysisResult.error || !analysisResult.data) {
        throw analysisResult.error ?? new Error("Analysis failed");
      }
      const intel = await debugVisionIntelligence(analysisResult.data);
      if (intel.error || !intel.data) {
        throw intel.error ?? new Error("Intelligence failed");
      }
      saveVisionSession(intel.data);
      setSession(intel.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Debug run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Vision Debug"
        badge={<Badge variant="secondary">Developer</Badge>}
        description="Raw VisionAnalysis plus Closet Scan / Outfit / Duplicate Intelligence scores. Writes a review session you can open at /vision/review."
        actions={
          <Button variant="outline" render={<Link href="/vision/review" />}>
            Open review
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Run</CardTitle>
          <CardDescription>Same /api/ai/vision path as production scans.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor={fileId} className="text-xs text-muted-foreground">
              Image
            </Label>
            <input
              id={fileId}
              type="file"
              accept="image/*"
              className="block text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button disabled={!file || busy} onClick={() => void run()}>
            {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Debug
          </Button>
          {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {session ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">VisionAnalysis</CardTitle>
              <CardDescription>
                {session.analysis.detectedItems.length} detections · confidence{" "}
                {Math.round(session.analysis.confidence * 100)}% · {session.analysis.quality}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed">
                {JSON.stringify(session.analysis, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Intelligence</CardTitle>
              <CardDescription>
                Duplicates: {session.duplicates?.warningCount ?? 0} · Queue pending:{" "}
                {session.queue.pendingCount}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed">
                {JSON.stringify(
                  {
                    closetScan: session.closetScan,
                    outfit: session.outfit,
                    duplicates: session.duplicates,
                    queue: session.queue,
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
