import {
  BarChart3Icon,
  CalendarDaysIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PlusIcon,
  ReceiptIcon,
  ShirtIcon,
} from "lucide-react";

import { registerCommands } from "@/features/command-palette/registry";

export const NAVIGATION_GROUP = "Navigation";
export const ACTIONS_GROUP = "Quick actions";

/**
 * Built-in commands. Other features can register more via
 * registerCommand(s) — the palette renders whatever the registry holds.
 */
export function registerBuiltinCommands(): void {
  registerCommands([
    {
      id: "nav.dashboard",
      title: "Dashboard",
      group: NAVIGATION_GROUP,
      icon: LayoutDashboardIcon,
      keywords: ["home", "overview"],
      run: (context) => context.navigate("/dashboard"),
    },
    {
      id: "nav.inventory",
      title: "Inventory",
      group: NAVIGATION_GROUP,
      icon: ShirtIcon,
      keywords: ["items", "wardrobe", "clothes"],
      run: (context) => context.navigate("/inventory"),
    },
    {
      id: "nav.purchases",
      title: "Purchases",
      group: NAVIGATION_GROUP,
      icon: ReceiptIcon,
      keywords: ["spending", "orders", "money"],
      run: (context) => context.navigate("/purchases"),
    },
    {
      id: "nav.wear-logs",
      title: "Wear Logs",
      group: NAVIGATION_GROUP,
      icon: CalendarDaysIcon,
      keywords: ["history", "worn"],
      run: (context) => context.navigate("/wear-logs"),
    },
    {
      id: "nav.analytics",
      title: "Analytics",
      group: NAVIGATION_GROUP,
      icon: BarChart3Icon,
      keywords: ["charts", "stats", "insights", "dashboard"],
      run: (context) => context.navigate("/dashboard"),
    },
    {
      id: "nav.outfits",
      title: "Outfits",
      group: NAVIGATION_GROUP,
      icon: LayersIcon,
      keywords: ["looks", "combinations"],
      run: (context) => context.navigate("/outfits"),
    },
    {
      id: "action.add-item",
      title: "Add Item",
      group: ACTIONS_GROUP,
      icon: PlusIcon,
      keywords: ["new", "create", "wardrobe"],
      run: (context) => context.navigate("/inventory?action=add-item"),
    },
    {
      id: "action.log-wear",
      title: "Log Wear",
      group: ACTIONS_GROUP,
      icon: CalendarDaysIcon,
      keywords: ["wore", "track"],
      run: (context) => context.navigate("/inventory"),
    },
    {
      id: "action.add-purchase",
      title: "Add Purchase",
      group: ACTIONS_GROUP,
      icon: ReceiptIcon,
      keywords: ["buy", "spend", "record"],
      run: (context) => context.navigate("/purchases"),
    },
    {
      id: "action.import-json",
      title: "Import JSON",
      group: ACTIONS_GROUP,
      icon: FileJsonIcon,
      keywords: ["upload", "sync"],
      run: (context) => context.navigate("/inventory/import?mode=json"),
    },
    {
      id: "action.import-csv",
      title: "Import CSV",
      group: ACTIONS_GROUP,
      icon: FileSpreadsheetIcon,
      keywords: ["upload", "spreadsheet"],
      run: (context) => context.navigate("/inventory/import?mode=csv"),
    },
  ]);
}
