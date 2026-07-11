/**
 * ReviewQueue (RFC-019) — pure queue of confirmation actions.
 * Never writes inventory or wear logs; only tracks pending/confirmed/dismissed.
 */

import type {
  ReviewQueue,
  ReviewQueueItem,
  ReviewItemStatus,
} from "@/domain/vision-intelligence/types";

export function buildReviewQueue(items: ReviewQueueItem[]): ReviewQueue {
  return summarize(items.map((i) => ({ ...i, status: i.status ?? "pending" })));
}

export function mergeReviewQueues(...queues: ReviewQueue[]): ReviewQueue {
  const seen = new Set<string>();
  const items: ReviewQueueItem[] = [];
  for (const q of queues) {
    for (const item of q.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return summarize(items);
}

export function setReviewItemStatus(
  queue: ReviewQueue,
  id: string,
  status: ReviewItemStatus,
): ReviewQueue {
  return summarize(
    queue.items.map((item) => (item.id === id ? { ...item, status } : item)),
  );
}

export function confirmReviewItem(queue: ReviewQueue, id: string): ReviewQueue {
  return setReviewItemStatus(queue, id, "confirmed");
}

export function dismissReviewItem(queue: ReviewQueue, id: string): ReviewQueue {
  return setReviewItemStatus(queue, id, "dismissed");
}

export function pendingReviewItems(queue: ReviewQueue): ReviewQueueItem[] {
  return queue.items.filter((i) => i.status === "pending");
}

function summarize(items: ReviewQueueItem[]): ReviewQueue {
  return {
    items,
    pendingCount: items.filter((i) => i.status === "pending").length,
    confirmedCount: items.filter((i) => i.status === "confirmed").length,
    dismissedCount: items.filter((i) => i.status === "dismissed").length,
  };
}

export function makeReviewId(prefix: string, detectionIndex: number, extra = ""): string {
  return `${prefix}:${detectionIndex}${extra ? `:${extra}` : ""}`;
}
