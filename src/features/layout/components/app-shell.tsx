"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Code2Icon, MenuIcon, PlusIcon, ShirtIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DEVELOPER_SECTION,
  NAV_SECTIONS,
  resolveActiveHref,
  type NavSection,
} from "@/features/layout/nav-config";
import { useDevMode } from "@/features/layout/use-dev-mode";
import { ThemeToggle } from "@/features/layout/components/theme-toggle";
import { cn } from "@/lib/utils";

function BrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-base font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ShirtIcon className="size-4" />
      </span>
      Wardrobe OS
    </Link>
  );
}

const ITEM_BASE =
  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors";

function NavLinks({
  sections,
  activeHref,
  onNavigate,
}: {
  sections: NavSection[];
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.heading} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {section.heading}
          </p>
          {section.items.map((item) => {
            const Icon = item.icon;

            // Future / unavailable destinations render as muted, non-clickable.
            if (item.disabled) {
              return (
                <div
                  key={`${section.heading}-${item.label}`}
                  aria-disabled="true"
                  title="Coming soon"
                  className={cn(ITEM_BASE, "cursor-not-allowed text-muted-foreground/50")}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {item.badge}
                    </Badge>
                  ) : null}
                </div>
              );
            }

            const isActive = activeHref === item.href;

            return (
              <Link
                key={`${section.heading}-${item.label}`}
                href={item.href}
                onClick={onNavigate}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  ITEM_BASE,
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {item.badge}
                  </Badge>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function DevModeToggle({
  devMode,
  onToggle,
}: {
  devMode: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={devMode}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        devMode
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Code2Icon className="size-4 shrink-0" />
      <span className="flex-1 text-left">Developer mode</span>
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
          devMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {devMode ? "On" : "Off"}
      </span>
    </button>
  );
}

function GlobalActions() {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/inventory?action=add-item" />}
      >
        <PlusIcon />
        <span className="hidden sm:inline">Add Item</span>
      </Button>
      <Button size="sm" render={<Link href="/outfits/new" />}>
        <PlusIcon />
        <span className="hidden sm:inline">Create Outfit</span>
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { devMode, toggle } = useDevMode();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const sections = useMemo(
    () => (devMode ? [...NAV_SECTIONS, DEVELOPER_SECTION] : NAV_SECTIONS),
    [devMode],
  );
  const activeHref = useMemo(
    () =>
      resolveActiveHref(
        pathname ?? "",
        sections.flatMap((section) => section.items),
      ),
    [pathname, sections],
  );

  // Close the mobile nav whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // The unlock screen (RFC-010) renders without app chrome — no nav/sidebar.
  if (pathname === "/unlock") {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
  }

  return (
    <div className="flex min-h-full flex-1">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 items-center border-b px-3">
          <BrandMark />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks sections={sections} activeHref={activeHref} />
        </div>
        <div className="border-t p-3">
          <DevModeToggle devMode={devMode} onToggle={toggle} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-8">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="lg:hidden"
                  aria-label="Open navigation menu"
                />
              }
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-14 items-center border-b px-3">
                <BrandMark />
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <NavLinks
                  sections={sections}
                  activeHref={activeHref}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </div>
              <div className="border-t p-3">
                <DevModeToggle devMode={devMode} onToggle={toggle} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <BrandMark />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <GlobalActions />
          </div>
        </header>

        <main id="main" className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
