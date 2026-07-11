/**
 * Session persistence for the Vision Intelligence review queue (client-only).
 * No schema — RFC-019 keeps the queue ephemeral.
 */

import type { ReviewQueue } from "@/domain/vision-intelligence";
import type { VisionScanSession } from "@/features/vision/types";

const STORAGE_KEY = "wardrobe.vision.scanSession.v1";

export function saveVisionSession(session: VisionScanSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // private mode / quota — ignore
  }
}

export function loadVisionSession(): VisionScanSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VisionScanSession;
  } catch {
    return null;
  }
}

export function updateVisionSessionQueue(queue: ReviewQueue): VisionScanSession | null {
  const session = loadVisionSession();
  if (!session) return null;
  const next = { ...session, queue };
  saveVisionSession(next);
  return next;
}

export function clearVisionSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
