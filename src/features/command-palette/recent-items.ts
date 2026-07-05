/**
 * Recently viewed wardrobe items, persisted in localStorage. Pages record
 * views via recordRecentItem; the palette reads them via getRecentItems.
 */

const STORAGE_KEY = "wardrobe-os.recent-items";
const MAX_RECENT_ITEMS = 10;

export type RecentItem = {
  id: string;
  name: string;
  code: string;
  viewedAt: string;
};

function readStorage(): RecentItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getRecentItems(): RecentItem[] {
  return readStorage().slice(0, MAX_RECENT_ITEMS);
}

export function recordRecentItem(item: {
  id: string;
  name: string;
  code: string;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  const next: RecentItem[] = [
    { ...item, viewedAt: new Date().toISOString() },
    ...readStorage().filter((entry) => entry.id !== item.id),
  ].slice(0, MAX_RECENT_ITEMS);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — recents are best-effort.
  }
}
