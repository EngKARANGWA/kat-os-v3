"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canOpen } from "@/lib/permissions";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MANAGER_NAV, NAV, type NavItem } from "./nav";

/** KAT logo block. */
export function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-linear-to-br from-brand-light to-brand text-sm font-bold text-white">KAT</div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-wide text-white">KIGALI APPLE TECH</div>
        <div className="text-[11px] tracking-[0.2em] text-sidebar-primary">KAT OS</div>
      </div>
    </div>
  );
}

function NavGroup({ title, items, isActive, onNavigate }: { title?: string; items: NavItem[]; isActive: (href: string) => boolean; onNavigate?: () => void }) {
  return (
    <div className="px-3">
      {title && <div className="px-3 pt-5 pb-2 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">{title}</div>}
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white",
            isActive(href) && "bg-sidebar-accent font-medium text-white shadow-[inset_3px_0_0_var(--sidebar-primary)]",
          )}
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </Link>
      ))}
    </div>
  );
}

/** The menu itself; used in the desktop sidebar and in the phone slide-out menu. */
export function SidebarNav({ me, onNavigate }: { me: User; onNavigate?: () => void }) {
  const pathname = usePathname();
  // Only the pages this person may open (see lib/permissions.ts).
  const daily = NAV.filter((l) => canOpen(me, l.href));
  const management = MANAGER_NAV.filter((l) => canOpen(me, l.href));
  const all = [...daily, ...management];
  // Exact match wins (e.g. /clients/new → "Register Client"); otherwise the section prefix (e.g. /clients/12 → "Clients").
  const exact = all.some((l) => l.href === pathname);
  const isActive = (href: string) => pathname === href || (!exact && href !== "/" && pathname.startsWith(href + "/"));

  return (
    <nav className="flex flex-col pb-6">
      <NavGroup items={daily} isActive={isActive} onNavigate={onNavigate} />
      {management.length > 0 && <NavGroup title="Management" items={management} isActive={isActive} onNavigate={onNavigate} />}
    </nav>
  );
}

/** Fixed sidebar on desktop (hidden on phones, where the top bar menu button opens it). */
export function Sidebar({ me }: { me: User }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto bg-sidebar lg:flex">
      <Brand />
      <SidebarNav me={me} />
    </aside>
  );
}
