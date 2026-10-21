"use client";

import { Banknote, CircleCheck, Hourglass, ShieldCheck, Wrench } from "lucide-react";
import { Async, PageHeader, StatCard, StatGrid } from "@/components/kat";
import { useApi } from "@/lib/api";
import { money } from "@/lib/format";

type Reports = { total: number; collected: number; revenue: number; outstanding: number; warranty: number };

export default function ReportsPage() {
  const { data, error } = useApi<Reports>("/reports");

  return (
    <>
      <PageHeader title="Reports" description="All-time totals across every repair ticket." />
      <Async data={data} error={error}>
        {(d) => (
          <StatGrid>
            <StatCard icon={Wrench} value={d.total} label="Total Tickets" />
            <StatCard icon={CircleCheck} value={d.collected} label="Collected" />
            <StatCard tone="brand" icon={Banknote} value={money(d.revenue)} label="RWF Received" />
            <StatCard icon={Hourglass} value={money(d.outstanding)} label="RWF Outstanding" />
            <StatCard icon={ShieldCheck} value={d.warranty} label="Active Warranties" />
          </StatGrid>
        )}
      </Async>
    </>
  );
}
