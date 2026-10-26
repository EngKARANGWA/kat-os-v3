"use client";

import { createContext, useContext } from "react";
import { ShieldAlert } from "lucide-react";
import { can } from "@/lib/permissions";
import type { User } from "@/lib/types";

export const SessionContext = createContext<User | null>(null);

/** The signed-in staff member. Only use inside the (app) pages, which guarantee a user. */
export function useMe(): User {
  const me = useContext(SessionContext);
  if (!me) throw new Error("useMe() used outside the signed-in layout");
  return me;
}

/** Shown instead of a page this staff member may not use. */
export function NoAccess({ children = "You do not have access to this page. Ask the General Manager." }: { children?: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <ShieldAlert className="size-5 shrink-0" />
      {children}
    </div>
  );
}

/** Shown to non-managers who open a General Manager page directly. */
export function ManagerOnly({ children }: { children: React.ReactNode }) {
  const me = useMe();
  if (!me.is_manager) return <NoAccess>General Manager access required.</NoAccess>;
  return <>{children}</>;
}

/** Only shows its content to staff with this permission (the General Manager always has it). */
export function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const me = useMe();
  if (!can(me, permission)) return <NoAccess />;
  return <>{children}</>;
}
