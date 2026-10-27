"use client";

import { Banknote, CircleCheck, Clock, Coins, Package, Receipt, TrendingUp, Wrench, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Async, DataTable, LinkButton, PageHeader, Panel, StatCard, StatGrid } from "@/components/kat";
import { PeriodPicker, periodFor, periodLabel, type Period } from "@/components/dashboard/PeriodPicker";
import { repairColumns as col } from "@/components/repairs/columns";
import { useMe } from "@/components/Session";
import { useApi } from "@/lib/api";
import { can } from "@/lib/permissions";
import { money } from "@/lib/format";
import type { RepairSummary } from "@/lib/types";

type Dashboard = {
  total: number;
  open_repairs: number;
  ready: number;
  overdue: number;
  low_stock: number;
  queued: number;
  recent: RepairSummary[];
  finance: {
    sales: number;
    parts_cost: number;
    expenses: number;
    profit: number;
    from: string;
    to: string;
  } | null;
};

export default function DashboardPage() {
  const me = useMe();
  const [period, setPeriod] = useState<Period>(() => periodFor("today"));
  // Only the money cards depend on the period; the repair counts are always "now".
  const { data, error, loading } = useApi<Dashboard>(`/dashboard?from=${period.from}&to=${period.to}`);
  const newRepair = can(me, "repairs") ? (
    <LinkButton href="/repairs/new" icon={<Plus />}>
      New Repair
    </LinkButton>
  ) : undefined;

  return (
    <>
      <PageHeader title={`${me.role} Dashboard`} description={`Welcome back, ${me.full_name}.`} action={newRepair} />
      <Async data={data} error={error}>
        {(d) => (
          <>
            {d.finance && (
              <section aria-label="Money" className={loading ? "opacity-60 transition-opacity" : undefined}>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Money</h2>
                    <p data-testid="money-period" className="text-sm text-muted-foreground">
                      {periodLabel(period)}
                    </p>
                  </div>
                  <PeriodPicker value={period} onChange={setPeriod} />
                </div>
                <StatGrid columns={4}>
                  <StatCard
                    tone="brand"
                    icon={Banknote}
                    value={`${money(d.finance.sales)} RWF`}
                    label={period.preset === "today" ? "Today's Sales" : "Sales"}
                  />
                  <StatCard icon={Coins} value={`${money(d.finance.parts_cost)} RWF`} label="Parts Cost" />
                  <StatCard icon={Receipt} value={`${money(d.finance.expenses)} RWF`} label="Expenses" />
                  <StatCard
                    tone={d.finance.profit < 0 ? "danger" : "brand"}
                    icon={TrendingUp}
                    value={`${money(d.finance.profit)} RWF`}
                    label="Net Profit / Loss"
                  />
                </StatGrid>
              </section>
            )}
            <StatGrid>
              <StatCard icon={Wrench} value={d.total} label="Total Repairs" />
              <StatCard icon={Clock} value={d.open_repairs} label="Active Repairs" />
              <StatCard icon={CircleCheck} value={d.ready} label="Ready" />
              <StatCard icon={TriangleAlert} value={d.overdue} label="Overdue" tone={d.overdue > 0 ? "danger" : "neutral"} />
              <StatCard icon={Package} value={d.low_stock} label="Low Stock" />
            </StatGrid>
            <Panel title="Recent Tickets">
              <DataTable
                rows={d.recent}
                rowKey={(r) => r.id}
                empty="No repairs yet."
                columns={[col.ticket, col.client, col.device, col.status, col.deadline]}
              />
            </Panel>
          </>
        )}
      </Async>
    </>
  );
}
