import type { LucideIcon } from "lucide-react";

/** Runtime context handed to a command when it runs. */
export type CommandContext = {
  /** Navigate the app router. */
  navigate: (href: string) => void;
  /** Close the palette. */
  close: () => void;
};

/** A registerable palette command. */
export type PaletteCommand = {
  /** Unique, stable id (e.g. "nav.inventory", "action.add-item"). */
  id: string;
  title: string;
  /** Display group, rendered as a cmdk group heading. */
  group: string;
  icon?: LucideIcon;
  /** Extra search terms beyond the title. */
  keywords?: string[];
  run: (context: CommandContext) => void;
};
