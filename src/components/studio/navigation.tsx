"use client";

import { ClipboardList, Home as HomeIcon, Package, Plus, Settings2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { initials } from "./format";
import type { View } from "./types";

export const navItems: { id: View; label: string; icon: typeof HomeIcon }[] = [
  { id: "today", label: "Today", icon: HomeIcon },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "add", label: "Add order", icon: Plus },
  { id: "products", label: "Products", icon: Package },
  { id: "profile", label: "Profile", icon: UserRound },
];

export function AppHeader({
  setView,
  businessLogo,
  ownerName,
}: {
  setView: (view: View) => void;
  businessLogo?: string;
  ownerName?: string;
}) {
  const logoStyle = businessLogo
    ? {
        backgroundImage: `url(${businessLogo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;
  const appIconStyle = {
    backgroundImage: "url('/icons/studio-192.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
      <Button
        variant="ghost"
        onClick={() => setView("today")}
        className="h-auto gap-2 p-0 text-left text-stone-950 hover:bg-transparent"
      >
        <span
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-brand"
          style={appIconStyle}
          aria-hidden="true"
        />
        <span className="text-lg font-bold tracking-tight">Studio</span>
      </Button>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setView("profile")}
          aria-label="Open business profile"
          title="Open business profile"
          className="overflow-hidden rounded-full bg-brand-soft p-0 font-bold text-brand"
        >
          {businessLogo ? (
            <span
              className="h-full w-full"
              style={logoStyle}
              aria-hidden="true"
            />
          ) : ownerName ? (
            initials(ownerName)
          ) : (
            <UserRound className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </header>
  );
}

export function Sidebar({
  view,
  setView,
  onAdd,
}: {
  view: View;
  setView: (view: View) => void;
  onAdd: () => void;
}) {
  const activeView =
    view === "summary" || view === "summary_orders" ? "profile" : view;
  return (
    <aside className="hidden border-r border-stone-200 p-4 lg:block">
      <nav className="space-y-1" aria-label="Studio navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activeView === id ? "default" : "ghost"}
            onClick={() => (id === "add" ? onAdd() : setView(id))}
            aria-current={activeView === id ? "page" : undefined}
            className={`w-full justify-start gap-3 ${activeView === id ? "bg-brand text-white hover:bg-teal-800" : "text-stone-600"}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </nav>
      <Separator className="my-8" />
      <p className="px-3 text-xs font-bold text-stone-400">Your setup</p>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setView("settings")}
        aria-label="Open settings"
        title="Settings"
        aria-current={view.startsWith("settings") ? "page" : undefined}
        className="mt-2 text-stone-600"
      >
        <Settings2 className="h-5 w-5" aria-hidden="true" />
      </Button>
    </aside>
  );
}

export function MobileNav({
  view,
  setView,
  onAdd,
}: {
  view: View;
  setView: (view: View) => void;
  onAdd: () => void;
}) {
  const activeView =
    view === "summary" || view === "summary_orders" ? "profile" : view;
  return (
    <nav
      className="mobile-navigation fixed z-30 flex max-w-6xl items-center gap-1 lg:hidden"
      aria-label="Mobile Studio navigation"
    >
      {navItems.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          variant="ghost"
          onClick={() => (id === "add" ? onAdd() : setView(id))}
          aria-label={label}
          aria-current={activeView === id ? "page" : undefined}
          title={label}
          className={`h-11 min-w-0 flex-1 justify-center rounded-xl px-0 ${activeView === id ? "text-stone-950" : "text-stone-400"}`}
        >
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${activeView === id ? "bg-brand text-white" : ""}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
        </Button>
      ))}
    </nav>
  );
}
