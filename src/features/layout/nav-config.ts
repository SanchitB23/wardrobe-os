import {
  ActivityIcon,
  CalendarDaysIcon,
  CameraIcon,
  ChartLineIcon,
  ClipboardCheckIcon,
  CompassIcon,
  FlaskConicalIcon,
  GaugeIcon,
  HeartPulseIcon,
  HomeIcon,
  ImagesIcon,
  InfoIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  MessagesSquareIcon,
  LuggageIcon,
  ReceiptIcon,
  ScanSearchIcon,
  SettingsIcon,
  ShirtIcon,
  ShoppingBagIcon,
  SparklesIcon,
  SlidersHorizontalIcon,
  TerminalIcon,
  UploadIcon,
  WandSparklesIcon,
  WrenchIcon,
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
      {
        label: "Inventory",
        href: "/inventory",
        icon: ShirtIcon,
        matchNested: true,
      },
      {
        label: "Outfits",
        href: "/outfits",
        icon: LayersIcon,
        matchNested: true,
      },
      { label: "Wear Logs", href: "/wear-logs", icon: CalendarDaysIcon },
      { label: "Vision", href: "/vision", icon: CameraIcon, matchNested: true },
    ],
  },
  {
    // Stylist = advice + acquisition decisions. Buy vs Skip / Screenshot
    // fold in here so the top level stays focused (RFC-007 IA).
    heading: "Stylist",
    items: [
      {
        label: "Intelligence Center",
        href: "/intelligence",
        icon: SparklesIcon,
      },
      {
        label: "Recommendations",
        href: "/recommendations",
        icon: WandSparklesIcon,
      },
      { label: "Chat", href: "/chat", icon: MessagesSquareIcon },
      {
        label: "Acquisitions",
        href: "/acquisitions",
        icon: ShoppingBagIcon,
        matchNested: true,
      },
      {
        label: "Buy vs Skip",
        href: "/acquisition/advisor",
        icon: CompassIcon,
        matchNested: true,
      },
      {
        label: "Screenshot",
        href: "/acquisition/screenshot",
        icon: ScanSearchIcon,
        matchNested: true,
      },
    ],
  },
  {
    heading: "Insights",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboardIcon },
      { label: "Health", href: "/dashboard/health", icon: HeartPulseIcon },
      { label: "Usage", href: "/dashboard/usage", icon: ChartLineIcon },
      { label: "Purchases", href: "/purchases", icon: ReceiptIcon },
      {
        label: "Insight Center",
        href: "/dashboard/insights",
        icon: LightbulbIcon,
      },
    ],
  },
  {
    heading: "Lifestyle",
    items: [
      { label: "Trips", href: "/trips", icon: LuggageIcon, matchNested: true },
    ],
  },
  {
    heading: "Settings",
    items: [
      { label: "Settings", href: "/settings", icon: SettingsIcon },
      {
        label: "Preferences",
        href: "/settings/preferences",
        icon: SlidersHorizontalIcon,
      },
      { label: "Import", href: "/inventory/import", icon: UploadIcon },
      { label: "Review", href: "/inventory/review", icon: ClipboardCheckIcon },
      { label: "About", href: "/about", icon: InfoIcon },
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
    {
      label: "Developer",
      href: "/developer",
      icon: WrenchIcon,
      matchNested: true,
    },
    { label: "AI Playground", href: "/ai/playground", icon: FlaskConicalIcon },
    { label: "Vision Debug", href: "/developer/vision", icon: CameraIcon },
    {
      label: "Inventory Images",
      href: "/developer/inventory-images",
      icon: ImagesIcon,
    },
    {
      label: "Acquisitions Debug",
      href: "/developer/acquisitions",
      icon: ShoppingBagIcon,
    },
    {
      label: "Observability",
      href: "/developer/observability",
      icon: ActivityIcon,
    },
    {
      label: "AI Runtime",
      href: "/developer/ai-runtime",
      icon: GaugeIcon,
    },
    {
      label: "Runtime Stats",
      href: "/developer/runtime-statistics",
      icon: GaugeIcon,
    },
    {
      label: "AI Test",
      href: "/api/ai/test",
      icon: TerminalIcon,
      external: true,
    },
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
