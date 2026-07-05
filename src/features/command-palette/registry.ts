import type { PaletteCommand } from "@/features/command-palette/types";

/**
 * Searchable command registry. Commands are registered by id (last write
 * wins) so features can contribute commands without touching palette
 * components.
 */
const commandsById = new Map<string, PaletteCommand>();

export function registerCommand(command: PaletteCommand): void {
  commandsById.set(command.id, command);
}

export function registerCommands(commands: readonly PaletteCommand[]): void {
  for (const command of commands) {
    registerCommand(command);
  }
}

export function unregisterCommand(id: string): void {
  commandsById.delete(id);
}

export function getRegisteredCommands(): PaletteCommand[] {
  return [...commandsById.values()];
}

/** Registration-ordered list of distinct groups. */
export function getCommandGroups(): string[] {
  const groups: string[] = [];
  for (const command of commandsById.values()) {
    if (!groups.includes(command.group)) {
      groups.push(command.group);
    }
  }
  return groups;
}
