import {
  CalendarDaysIcon,
  ChartLineIcon,
  ClipboardCheckIcon,
  HeartPulseIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  ReceiptIcon,
  SettingsIcon,
  ShirtIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match nested routes (e.g. /inventory/[id]) as active too. */
  matchNested?: boolean;
};

export type NavSection = {
  heading: string;
  items: NavItem[];
};

/**
 * Global navigation model. Sections/items are data, not markup, so the shell
 * renders whatever this config holds and new destinations are one edit away.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
      { label: "Health", href: "/dashboard/health", icon: HeartPulseIcon },
      { label: "Usage", href: "/dashboard/usage", icon: ChartLineIcon },
      { label: "Insights", href: "/dashboard/insights", icon: LightbulbIcon },
    ],
  },
  {
    heading: "Wardrobe",
    items: [
      { label: "Inventory", href: "/inventory", icon: ShirtIcon, matchNested: true },
      { label: "Outfits", href: "/outfits", icon: LayersIcon, matchNested: true },
      { label: "Purchases", href: "/purchases", icon: ReceiptIcon },
      { label: "Wear Logs", href: "/wear-logs", icon: CalendarDaysIcon },
    ],
  },
  {
    heading: "Data",
    items: [
      { label: "Import", href: "/inventory/import", icon: UploadIcon },
      { label: "Review", href: "/inventory/review", icon: ClipboardCheckIcon },
      { label: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];

/** Flat list of every nav item, for lookups. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);

/**
 * Resolves the active href for a pathname. Prefers the most specific match so
 * /inventory/import highlights Import, not Inventory.
 */
export function resolveActiveHref(pathname: string): string | null {
  const candidates = NAV_ITEMS.filter((item) => {
    if (item.href === pathname) {
      return true;
    }
    return item.matchNested && pathname.startsWith(`${item.href}/`);
  });

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, item) =>
    item.href.length > best.href.length ? item : best,
  ).href;
}
