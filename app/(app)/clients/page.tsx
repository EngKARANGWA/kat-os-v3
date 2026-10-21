"use client";

import Link from "next/link";
import { CalendarDays, CalendarPlus, UserPlus, Users, Wrench } from "lucide-react";
import { Async, DataTable, LinkButton, PageHeader, Panel, StatCard, StatGrid, useFilters } from "@/components/kat";
import { todayISO } from "@/lib/constants";
import { useApi } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { Client } from "@/lib/types";

export default function ClientsPage() {
  const { data, error } = useApi<{ clients: Client[] }>("/clients");
  const { rows, bar, filtering } = useFilters(
    data?.clients ?? [],
    {
      placeholder: "Search name, phone, email, IMEI / serial, device model, KAT ticket…",
      search: (c) => [c.full_name, c.phone, c.email, c.address, ...(c.tickets ?? []), ...(c.repair_serials ?? []), ...(c.devices ?? []).flatMap((d) => [d.serial_imei, d.model])],
      filters: [
        { kind: "toggle", key: "open", label: "With open repairs", test: (c) => (c.open_repairs ?? 0) > 0 },
        { kind: "toggle", key: "none", label: "No repairs yet", test: (c) => c.repair_count === 0 },
        { kind: "dates", key: "registered", label: "Registered", value: (c) => c.created_at },
      ],
    },
    "clients",
  );
  const all = data?.clients ?? [];
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const registeredOn = (c: Client) => c.created_at.slice(0, 10);

  return (
    <>
      <PageHeader
        title="Clients"
        action={
          <LinkButton href="/clients/new" icon={<UserPlus />}>
            Register
          </LinkButton>
        }
      />
      {data && (
        <StatGrid columns={4}>
          <StatCard tone="brand" icon={Users} value={all.length.toLocaleString("en-US")} label="Total clients" />
          <StatCard icon={Wrench} value={all.filter((c) => (c.open_repairs ?? 0) > 0).length} label="With open repairs" />
          <StatCard icon={CalendarDays} value={all.filter((c) => registeredOn(c).startsWith(thisMonth)).length} label="Registered this month" />
          <StatCard icon={CalendarPlus} value={all.filter((c) => registeredOn(c) === today).length} label="Registered today" />
        </StatGrid>
      )}
      <Panel>
        <Async data={data} error={error}>
          {() => (
            <>
              {bar}
              <DataTable
                rows={rows}
                rowKey={(c) => c.id}
                empty={filtering ? "No clients match these filters." : "No clients yet."}
                columns={[
                  {
                    header: "Name",
                    cell: (c) => (
                      <Link href={`/clients/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.full_name}
                      </Link>
                    ),
                  },
                  { header: "Phone", cell: (c) => c.phone },
                  { header: "Email", cell: (c) => c.email || "—" },
                  { header: "Repairs", cell: (c) => (c.open_repairs ? `${c.repair_count} (${c.open_repairs} open)` : c.repair_count) },
                  { header: "Registered", cell: (c) => fmtDate(c.created_at) },
                ]}
              />
            </>
          )}
        </Async>
      </Panel>
    </>
  );
}
