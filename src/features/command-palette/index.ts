export { CommandPalette } from "@/features/command-palette/components/command-palette";
export {
  registerCommand,
  registerCommands,
  unregisterCommand,
  getRegisteredCommands,
} from "@/features/command-palette/registry";
export { recordRecentItem, getRecentItems } from "@/features/command-palette/recent-items";
export type { CommandContext, PaletteCommand } from "@/features/command-palette/types";
