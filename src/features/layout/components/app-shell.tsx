"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuIcon, PlusIcon, ShirtIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  NAV_SECTIONS,
  resolveActiveHref,
} from "@/features/layout/nav-config";
import { cn } from "@/lib/utils";

function BrandMark() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-base font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ShirtIcon className="size-4" />
      </span>
      Wardrobe OS
    </Link>
  );
}

function NavLinks({
  activeHref,
  onNavigate,
}: {
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-5">
      {NAV_SECTIONS.map((section) => (
        <div key={section.heading} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            {section.heading}
          </p>
          {section.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeHref === item.href;

            return (
              <Link
                key={`${section.heading}-${item.label}`}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
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
  const activeHref = resolveActiveHref(pathname ?? "");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the mobile nav whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-full flex-1">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 items-center border-b px-3">
          <BrandMark />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks activeHref={activeHref} />
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
                  activeHref={activeHref}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <BrandMark />
          </div>

          <div className="ml-auto">
            <GlobalActions />
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
