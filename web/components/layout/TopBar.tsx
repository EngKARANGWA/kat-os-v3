"use client";

import { useState } from "react";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { User } from "@/lib/types";
import { GlobalSearch } from "./GlobalSearch";
import { Brand, SidebarNav } from "./Sidebar";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Top bar: phone menu button, title, and the signed-in user's menu (with Logout). */
export function TopBar({ me, onLogout }: { me: User; onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-2">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 gap-0 overflow-y-auto border-0 bg-sidebar p-0 [&_[data-slot=sheet-close]]:text-white [&_[data-slot=sheet-close]]:hover:bg-sidebar-accent">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Brand />
            <SidebarNav manager={me.is_manager} onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="hidden whitespace-nowrap md:block">
          <span className="font-semibold">KAT OS</span>
          <span className="ml-2 hidden text-sm text-muted-foreground xl:inline">Repair Operations</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 justify-center">
        <GlobalSearch />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 gap-2 px-2" aria-label="Account menu">
            <Avatar className="size-8">
              <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{initials(me.full_name)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium">{me.full_name}</span>
              <span className="block text-xs text-muted-foreground">{me.role}</span>
            </span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="font-medium">{me.full_name}</div>
            <div className="text-xs font-normal text-muted-foreground">
              {me.role}
              {me.branch ? ` · ${me.branch}` : ""}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onLogout}>
            <LogOut />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
