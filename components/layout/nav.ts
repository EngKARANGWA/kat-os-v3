import {
  Bell,
  Building2,
  ChartColumn,
  FileText,
  History,
  LayoutDashboard,
  Package,
  ScanLine,
  ScrollText,
  ShoppingBag,
  Tags,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// Sidebar menu. MANAGER_NAV is only shown to the General Manager.
export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/device/scan", label: "Scan IMEI / Serial", icon: ScanLine },
  { href: "/clients/new", label: "Register Client", icon: UserPlus },
  { href: "/repairs", label: "Repairs", icon: Wrench },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/services", label: "Services & Prices", icon: Tags },
  { href: "/terms", label: "Repair T&Cs", icon: ScrollText },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/reports", label: "Reports", icon: ChartColumn },
];

export const MANAGER_NAV: NavItem[] = [
  { href: "/products", label: "Products", icon: ShoppingBag },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/admin/users", label: "Users", icon: UserCog },
  { href: "/admin/branches", label: "Branches", icon: Building2 },
  { href: "/admin/audit", label: "Audit Log", icon: History },
];
