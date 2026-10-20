import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Responsive row of stat cards (2 per row on phones, `columns` per row on wide screens). */
export function StatGrid({ children, columns = 5 }: { children: React.ReactNode; columns?: 4 | 5 }) {
  return <div className={cn("mb-6 grid grid-cols-2 gap-4 md:grid-cols-3", columns === 4 ? "md:grid-cols-4" : "xl:grid-cols-5")}>{children}</div>;
}

type StatCardProps = { value: React.ReactNode; label: string; icon?: LucideIcon; tone?: "brand" | "danger" | "neutral" };

/** One key number, e.g. <StatCard value="2,000 RWF" label="Net Profit / Loss" icon={TrendingUp} />. */
export function StatCard({ value, label, icon: Icon, tone = "neutral" }: StatCardProps) {
  return (
    <Card
      data-stat={label}
      className={cn(
        "gap-2 px-4",
        tone === "brand" && "bg-linear-to-br from-brand-light to-brand text-white ring-0",
        tone === "danger" && "bg-destructive text-white ring-0",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-sm", tone === "neutral" ? "text-muted-foreground" : "text-white/85")}>{label}</span>
        {Icon && (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", tone === "neutral" ? "bg-secondary text-secondary-foreground" : "bg-white/15")}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div data-stat-value className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
    </Card>
  );
}
