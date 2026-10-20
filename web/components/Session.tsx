"use client";

import { createContext, useContext } from "react";
import { ShieldAlert } from "lucide-react";
import type { User } from "@/lib/types";

export const SessionContext = createContext<User | null>(null);

/** The signed-in staff member. Only use inside the (app) pages, which guarantee a user. */
export function useMe(): User {
  const me = useContext(SessionContext);
  if (!me) throw new Error("useMe() used outside the signed-in layout");
  return me;
}

/** Shown to non-managers who open a General Manager page directly. */
export function ManagerOnly({ children }: { children: React.ReactNode }) {
  const me = useMe();
  if (!me.is_manager)
    return (
      <div role="alert" className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <ShieldAlert className="size-5 shrink-0" />
        General Manager access required.
      </div>
    );
  return <>{children}</>;
}
