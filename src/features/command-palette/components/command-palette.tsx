"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HistoryIcon, ShirtIcon } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { registerBuiltinCommands } from "@/features/command-palette/builtin-commands";
import {
  getCommandGroups,
  getRegisteredCommands,
} from "@/features/command-palette/registry";
import {
  getRecentItems,
  type RecentItem,
} from "@/features/command-palette/recent-items";
import type { CommandContext } from "@/features/command-palette/types";
import { useWardrobeItems } from "@/features/inventory/hooks";

registerBuiltinCommands();

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // Item rows load lazily: only once the palette is opened.
  const itemsQuery = useWardrobeItems({});
  const items = useMemo(
    () => (open ? (itemsQuery.data ?? []) : []),
    [open, itemsQuery.data],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setRecentItems(getRecentItems());
    }
  }, [open]);

  const context: CommandContext = {
    navigate: (href) => {
      setOpen(false);
      router.push(href);
    },
    close: () => setOpen(false),
  };

  const commands = getRegisteredCommands();
  const groups = getCommandGroups();
  const recentIds = new Set(recentItems.map((entry) => entry.id));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands, pages, and items…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {recentItems.length > 0 ? (
          <>
            <CommandGroup heading="Recent items">
              {recentItems.map((entry) => (
                <CommandItem
                  key={`recent-${entry.id}`}
                  value={`recent ${entry.name} ${entry.code}`}
                  onSelect={() => context.navigate(`/inventory/${entry.id}`)}
                >
                  <HistoryIcon />
                  <span className="truncate">{entry.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {entry.code}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        {groups.map((group) => (
          <CommandGroup key={group} heading={group}>
            {commands
              .filter((command) => command.group === group)
              .map((command) => {
                const Icon = command.icon;
                return (
                  <CommandItem
                    key={command.id}
                    value={`${command.title} ${(command.keywords ?? []).join(" ")}`}
                    onSelect={() => command.run(context)}
                  >
                    {Icon ? <Icon /> : null}
                    <span>{command.title}</span>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        ))}

        {items.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Items">
              {items
                .filter((item) => !recentIds.has(item.id))
                .map((item) => (
                  <CommandItem
                    key={`item-${item.id}`}
                    value={`${item.name} ${item.code} ${item.brand?.name ?? ""}`}
                    onSelect={() => context.navigate(`/inventory/${item.id}`)}
                  >
                    <ShirtIcon />
                    <span className="truncate">{item.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {[item.code, item.brand?.name].filter(Boolean).join(" · ")}
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
