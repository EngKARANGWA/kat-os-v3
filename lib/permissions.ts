import type { User } from "@/lib/types";

/** What a page needs: any one of these permissions, or "manager" (General Manager only). Same rules as the API. */
type Need = string[] | "manager";

// Longest matching prefix wins, e.g. /clients/new → "/clients".
const PAGES: [prefix: string, need: Need][] = [
  ["/device/scan", ["clients", "repairs"]],
  ["/clients", ["clients", "repairs"]],
  ["/repairs", ["repairs"]],
  ["/inventory", ["inventory"]],
  ["/documents", ["documents"]],
  ["/services", ["services"]],
  ["/terms", ["repairs"]],
  ["/notifications", ["notifications"]],
  ["/reports", ["reports"]],
  ["/products", ["products"]],
  ["/expenses", ["expenses"]],
  ["/admin", "manager"],
];

/** Does this staff member have at least one of these permissions? */
export function can(me: User, ...keys: string[]) {
  return me.is_manager || keys.some((k) => me.permissions.includes(k));
}

/** May this staff member open this page? Pages not listed (e.g. the dashboard) are open to everyone signed in. */
export function canOpen(me: User, path: string) {
  const match = PAGES.filter(([prefix]) => path === prefix || path.startsWith(prefix + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  if (!match) return true;
  const need = match[1];
  return need === "manager" ? me.is_manager : can(me, ...need);
}
