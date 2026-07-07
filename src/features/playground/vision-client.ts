/**
 * Client caller for the Vision Engine endpoint (RFC-002). Reads a File into a
 * base64 data payload and POSTs it; returns the standardized VisionAnalysis.
 * No server-only code here.
 */

import type { VisionAnalysis, VisionSource } from "@/domain/vision";

/** Read a File into { base64, mimeType } without the data: URL prefix. */
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

export async function analyzeImageRequest(params: {
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
