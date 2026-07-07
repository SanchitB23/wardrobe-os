import {
  BookmarkIcon,
  CalendarDaysIcon,
  ChartLineIcon,
  ClipboardCheckIcon,
  CompassIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  GitCompareIcon,
  HeartPulseIcon,
  HomeIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  MessagesSquareIcon,
  ReceiptIcon,
  SettingsIcon,
  ShirtIcon,
  TerminalIcon,
  UploadIcon,
  WandSparklesIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match nested routes (e.g. /inventory/[id]) as active too. */
  matchNested?: boolean;
  /** Rendered as a non-clickable, muted item (future/unavailable). */
  disabled?: boolean;
  /** Small badge, e.g. "Soon". */
  badge?: string;
  /** Open in a new tab (e.g. a raw API/debug endpoint). */
  external?: boolean;
};

export type NavSection = {
  heading: string;
  items: NavItem[];
};

/**
 * Global navigation model, organised around user workflows (not build order):
 * Today → Wardrobe → Stylist → Insights → Acquisition → Settings. Sections and
 * items are data, not markup, so the shell renders whatever this config holds.
 *
 * Routes are preserved from earlier versions — this is a regrouping/relabelling,
 * not a route change (Insights "Overview" is the existing /dashboard, etc.).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Home",
    items: [{ label: "Today", href: "/", icon: HomeIcon }],
  },
  {
    heading: "Wardrobe",
    items: [
      { label: "Inventory", href: "/inventory", icon: ShirtIcon, matchNested: true },
      { label: "Outfits", href: "/outfits", icon: LayersIcon, matchNested: true },
      { label: "Wear Logs", href: "/wear-logs", icon: CalendarDaysIcon },
    ],
  },
  {
    heading: "Stylist",
    items: [
      { label: "Recommendations", href: "/recommendations", icon: WandSparklesIcon },
      { label: "Chat", href: "/chat", icon: MessagesSquareIcon },
    ],
  },
  {
    heading: "Insights",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboardIcon },
      { label: "Health", href: "/dashboard/health", icon: HeartPulseIcon },
      { label: "Usage", href: "/dashboard/usage", icon: ChartLineIcon },
      { label: "Purchases", href: "/purchases", icon: ReceiptIcon },
      { label: "Insight Center", href: "/dashboard/insights", icon: LightbulbIcon },
    ],
  },
  {
    heading: "Acquisition",
    items: [
      { label: "Advisor", href: "/acquisition/advisor", icon: CompassIcon, matchNested: true },
      { label: "Wishlist", href: "#", icon: BookmarkIcon, disabled: true, badge: "Soon" },
      { label: "Compare", href: "#", icon: GitCompareIcon, disabled: true, badge: "Soon" },
    ],
  },
  {
    heading: "Settings",
    items: [
      { label: "Settings", href: "/settings", icon: SettingsIcon },
      { label: "Import", href: "/inventory/import", icon: UploadIcon },
      { label: "Review", href: "/inventory/review", icon: ClipboardCheckIcon },
    ],
  },
];

/**
 * Developer-only section. Appended to the sidebar ONLY when developer mode is
 * enabled, so debug surfaces (AI Playground, the AI test endpoint) stay out of
 * primary user navigation. `AI Cache` has no dedicated page today, so it is not
 * listed — add it here if a cache-inspection UI is built.
 */
export const DEVELOPER_SECTION: NavSection = {
  heading: "Developer",
  items: [
    { label: "AI Playground", href: "/ai/playground", icon: FlaskConicalIcon },
    { label: "AI Test", href: "/api/ai/test", icon: TerminalIcon, external: true },
    // Placeholder for a future AI cache inspector (no UI yet).
    { label: "AI Cache", href: "#", icon: DatabaseIcon, disabled: true, badge: "Soon" },
  ],
};

/** Flat list of every base nav item, for lookups. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);

/**
 * Resolves the active href for a pathname against a set of items (defaults to
 * the base nav). Prefers the most specific match, and ignores disabled /
 * external / placeholder (`#`) items.
 */
export function resolveActiveHref(
  pathname: string,
  items: NavItem[] = NAV_ITEMS,
): string | null {
  const candidates = items.filter((item) => {
    if (item.disabled || item.external || item.href === "#") {
      return false;
    }
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
