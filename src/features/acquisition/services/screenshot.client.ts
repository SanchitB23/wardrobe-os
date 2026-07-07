/**
 * Client helpers for the screenshot flow (RFC-003): read a File to base64,
 * call the Vision Engine, and (optionally) fetch a verdict explanation. No
 * server-only code here.
 */

import type { VisionAnalysis, VisionSource } from "@/domain/vision";
import type { BuyVsSkipAnalysis } from "@/domain/acquisition";
import type { BuyVsSkipExplanation } from "@/features/acquisition/ai/buy-vs-skip-explanation";

export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve({ base64: comma >= 0 ? result.slice(comma + 1) : result, mimeType: file.type });
    };
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

export async function analyzeScreenshot(params: {
  imageBase64: string;
  mimeType: string;
  source: VisionSource;
}): Promise<VisionAnalysis> {
  const response = await fetch("/api/ai/vision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: VisionAnalysis }
    | { ok: false; error?: string }
    | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error((payload && "error" in payload && payload.error) || "Vision analysis failed.");
  }
  return payload.data;
}

export async function explainVerdict(analysis: BuyVsSkipAnalysis): Promise<BuyVsSkipExplanation> {
  const response = await fetch("/api/ai/explain-buy-vs-skip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(analysis),
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: BuyVsSkipExplanation }
    | { ok: false; error?: string }
    | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error((payload && "error" in payload && payload.error) || "Couldn't explain the verdict.");
  }
  return payload.data;
}
