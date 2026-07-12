"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ImageIcon,
  Loader2Icon,
  ScanSearchIcon,
  SparklesIcon,
} from "lucide-react";

import type { VisionAnalysis, VisionSource } from "@/domain/vision";
import { interpretShoppingImage } from "@/domain/acquisition";
import type { BuyVsSkipAnalysis, ProspectiveItem } from "@/domain/acquisition";
import type { BuyVsSkipExplanation } from "@/features/acquisition/ai/buy-vs-skip-explanation";
import {
  analyzeScreenshot,
  explainVerdict,
  fileToBase64,
} from "@/features/acquisition/services/screenshot.client";
import { useBuyVsSkip } from "@/features/acquisition/hooks/useBuyVsSkip";
import { BuyVsSkipResult } from "@/features/acquisition/components/BuyVsSkipResult";
import { ProspectiveItemForm } from "@/features/acquisition/components/ProspectiveItemForm";
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
import { cn } from "@/lib/utils";

const SOURCES: VisionSource[] = [
  "shopping_screenshot",
  "myntra",
  "amazon",
  "pinterest",
  "gallery",
  "camera",
];

const QUALITY_TONE: Record<string, string> = {
  excellent: "text-emerald-600 dark:text-emerald-400",
  good: "text-emerald-600 dark:text-emerald-400",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-destructive",
};

export function ScreenshotAdvisorView() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [source, setSource] = useState<VisionSource>("shopping_screenshot");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [lastItem, setLastItem] = useState<ProspectiveItem | null>(null);

  const vision = useMutation<VisionAnalysis, Error, void>({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a screenshot first.");
      const { base64, mimeType } = await fileToBase64(file);
      return analyzeScreenshot({ imageBase64: base64, mimeType, source });
    },
  });

  const buyVsSkip = useBuyVsSkip();

  const explain = useMutation<BuyVsSkipExplanation, Error, BuyVsSkipAnalysis>({
    mutationFn: (analysis) => explainVerdict(analysis),
  });

  // Deterministic interpretation of the vision output → an editable candidate.
  const candidate = useMemo(
    () =>
      vision.data
        ? interpretShoppingImage(vision.data, { preferItemIndex: selectedIndex })
        : null,
    [vision.data, selectedIndex],
  );

  const detectedItems = vision.data?.detectedItems ?? [];
  const multiItem = detectedItems.length > 1;

  function onPick(next: File | null) {
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
    setSelectedIndex(0);
    setLastItem(null);
    vision.reset();
    buyVsSkip.reset();
    explain.reset();
  }

  function selectItem(index: number) {
    if (index === selectedIndex) return;
    setSelectedIndex(index);
    // A different product means a different verdict — clear stale results.
    buyVsSkip.reset();
    explain.reset();
    setLastItem(null);
  }

  function runBuyVsSkip(item: ProspectiveItem) {
    explain.reset();
    setLastItem(item);
    buyVsSkip.mutate({ item, inputSource: "image" });
  }

  const lowConfidence =
    candidate != null &&
    (candidate.quality === "poor" ||
      candidate.quality === "fair" ||
      candidate.confidence < 0.6);

  // Local narrows to BuyVsSkipAnalysis inside closures (e.g. the Explain button).
  const verdict = buyVsSkip.data?.analysis;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Screenshot → Buy vs Skip"
        badge={<Badge variant="secondary">Acquisition</Badge>}
        description="Drop a shopping screenshot. The Vision Engine reads the item, you correct anything it got wrong, and the deterministic engine scores it against your wardrobe. Vision observes, you edit, engines decide — AI only explains."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* Step 1 — upload + analyze */}
        <div className="space-y-6">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1 · Upload a screenshot</CardTitle>
              <CardDescription>
                A product page, listing, or photo. The Vision Engine extracts a candidate item.
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
                <img src={previewUrl} alt="Selected screenshot" className="max-h-56 w-full rounded-lg border object-contain" />
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

              <Button className="w-full" disabled={!file || vision.isPending} onClick={() => vision.mutate()}>
                {vision.isPending ? <Loader2Icon className="animate-spin" /> : <ScanSearchIcon />}
                {vision.isPending ? "Reading screenshot…" : "Read screenshot"}
              </Button>
              {vision.isError ? <p className="text-sm text-destructive">{vision.error.message}</p> : null}
            </CardContent>
          </Card>

          {/* Step 2 — review + edit the candidate */}
          {candidate ? (
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">2 · Review the item</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn("capitalize", QUALITY_TONE[candidate.quality])}>
                      {candidate.quality}
                    </Badge>
                    <Badge variant="outline" className="tabular-nums">
                      {Math.round(candidate.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  {detectedItems.length === 0
                    ? "Nothing was detected — fill the item in by hand, then analyze."
                    : "Correct anything the Vision Engine got wrong. Flagged fields are low-confidence guesses."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {multiItem ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {detectedItems.length} items detected — pick one to evaluate
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {detectedItems.map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectItem(i)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-sm transition-colors",
                            i === selectedIndex
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input hover:bg-muted",
                          )}
                        >
                          {item.styleDNACandidate.name || item.label || item.category || `Item ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {lowConfidence ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Low-confidence read — the Vision Engine wasn&apos;t sure about this image. Double-check
                      the flagged fields (and add a price) before trusting the verdict.
                    </span>
                  </div>
                ) : null}

                <ProspectiveItemForm
                  // Reseed the form whenever the image or the selected item changes.
                  key={`${candidate.provenance.imageHash}-${selectedIndex}`}
                  initial={candidate.item}
                  lowConfidenceFields={candidate.lowConfidenceFields}
                  onAnalyze={runBuyVsSkip}
                  isAnalyzing={buyVsSkip.isPending}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Step 3 — verdict */}
        <div className="space-y-4">
          {buyVsSkip.isPending ? (
            <Card>
              <CardContent className="flex items-center gap-2 py-12 text-muted-foreground">
                <Loader2Icon className="size-5 animate-spin" />
                Scoring against your wardrobe…
              </CardContent>
            </Card>
          ) : null}

          {buyVsSkip.isError ? (
            <Card className="border-destructive/30">
              <CardContent className="py-8 text-center text-sm text-destructive">
                {buyVsSkip.error.message || "Couldn't run the analysis."}
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => buyVsSkip.reset()}>
                    Try again
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!buyVsSkip.isPending && !buyVsSkip.isError && verdict && lastItem ? (
            <>
              <BuyVsSkipResult
                analysis={verdict}
                item={lastItem}
                source="image"
                decisionId={buyVsSkip.data?.decisionId}
                imageCandidate={
                  file
                    ? { file, url: previewUrl }
                    : previewUrl
                      ? { url: previewUrl }
                      : null
                }
              />
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">Explain this verdict</CardTitle>
                      <CardDescription>
                        Optional. The AI explains the deterministic verdict in plain language — it never
                        changes the decision.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={explain.isPending}
                      onClick={() => explain.mutate(verdict)}
                    >
                      {explain.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                      {explain.isPending ? "Explaining…" : explain.data ? "Regenerate" : "Explain"}
                    </Button>
                  </div>
                </CardHeader>
                {explain.isError ? (
                  <CardContent className="text-sm text-destructive">{explain.error.message}</CardContent>
                ) : null}
                {explain.data ? (
                  <CardContent className="space-y-4 text-sm">
                    <p>{explain.data.summary}</p>
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                        Why this verdict
                      </h4>
                      <p className="text-muted-foreground">{explain.data.whyThisVerdict}</p>
                    </div>
                    {explain.data.keyFactors.length > 0 ? (
                      <div className="space-y-1">
                        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                          Key factors
                        </h4>
                        <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                          {explain.data.keyFactors.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {explain.data.thingsToWatch.length > 0 ? (
                      <div className="space-y-1">
                        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                          Things to watch
                        </h4>
                        <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                          {explain.data.thingsToWatch.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </CardContent>
                ) : null}
              </Card>
            </>
          ) : null}

          {!buyVsSkip.isPending && !buyVsSkip.isError && !buyVsSkip.data ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <ScanSearchIcon className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Upload a screenshot to start</p>
                  <p className="max-w-sm text-sm">
                    The Vision Engine reads the item, you fix anything it got wrong, then press Analyze
                    to see whether it&apos;s worth buying.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
