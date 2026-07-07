"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImageIcon, Loader2Icon, ScanSearchIcon } from "lucide-react";

import type { VisionAnalysis, VisionSource } from "@/domain/vision";
import { analyzeImageRequest, fileToBase64 } from "@/features/playground/vision-client";
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
import { cn } from "@/lib/utils";

const SOURCES: VisionSource[] = [
  "gallery",
  "camera",
  "shopping_screenshot",
  "myntra",
  "amazon",
  "pinterest",
  "closet_photo",
  "outfit_selfie",
];

const QUALITY_TONE: Record<string, string> = {
  excellent: "text-emerald-600 dark:text-emerald-400",
  good: "text-emerald-600 dark:text-emerald-400",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-destructive",
};

export function VisionPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [source, setSource] = useState<VisionSource>("gallery");

  const run = useMutation<VisionAnalysis, Error, void>({
    mutationFn: async () => {
      if (!file) throw new Error("Choose an image first.");
      const { base64, mimeType } = await fileToBase64(file);
      return analyzeImageRequest({ imageBase64: base64, mimeType, source });
    },
  });

  function onPick(next: File | null) {
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
    run.reset();
  }

  const result = run.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Image → VisionAnalysis</CardTitle>
          <CardDescription>
            Vision Engine only — no inventory, shopping, or recommendations. Returns the standardized
            VisionAnalysis JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Image</Label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            />
          </div>

          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Selected preview" className="max-h-56 w-full rounded-lg border object-contain" />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <ImageIcon className="size-6" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Source</Label>
            <Select value={source} onValueChange={(v) => v && setSource(v as VisionSource)}>
              <SelectTrigger className="w-full">
                <span className="flex flex-1 text-left">{source}</span>
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" disabled={!file || run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? <Loader2Icon className="animate-spin" /> : <ScanSearchIcon />}
            {run.isPending ? "Analyzing…" : "Analyze image"}
          </Button>
          {run.isError ? <p className="text-sm text-destructive">{run.error.message}</p> : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {!result && !run.isPending ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <ScanSearchIcon className="size-7" />
              <p>Upload an image and press Analyze to see the VisionAnalysis JSON.</p>
            </CardContent>
          </Card>
        ) : null}

        {result ? (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Result</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{result.detectedItems.length} item(s)</Badge>
                <Badge variant="secondary" className={cn("capitalize", QUALITY_TONE[result.quality])}>
                  {result.quality}
                </Badge>
                <Badge variant="outline" className="tabular-nums">
                  {Math.round(result.confidence * 100)}% confidence
                </Badge>
                {result.metadata.latencyMs != null ? (
                  <Badge variant="outline" className="tabular-nums">
                    {result.metadata.latencyMs} ms
                  </Badge>
                ) : null}
                <Badge variant="outline" className="font-mono text-[10px]">
                  {result.metadata.imageHash}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">VisionAnalysis JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
