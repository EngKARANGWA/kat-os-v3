"use client";

import { Plus } from "lucide-react";
import { Async, DataTable, LinkButton, PageHeader, Panel, useFilters } from "@/components/kat";
import { repairColumns as col } from "@/components/repairs/columns";
import { useApi } from "@/lib/api";
import { CLOSED_STATUSES, REPAIR_STATUSES, todayISO } from "@/lib/constants";
import type { RepairSummary } from "@/lib/types";

const isOverdue = (r: RepairSummary) => !!r.deadline && r.deadline < todayISO() && !["Ready", ...CLOSED_STATUSES].includes(r.status);

export default function RepairsPage() {
  const { data, error } = useApi<{ repairs: RepairSummary[] }>("/repairs");
  const { rows, bar, filtering } = useFilters(
    data?.repairs ?? [],
    {
      placeholder: "Search ticket, client, phone, device, IMEI / serial…",
      search: (r) => [r.ticket_code, r.client_name, r.client_phone, r.device, r.serial_imei, r.problem_category, r.technician],
      filters: [
        { kind: "select", key: "status", label: "Statuses", value: (r) => r.status, options: REPAIR_STATUSES },
        { kind: "select", key: "tech", label: "Technicians", value: (r) => r.technician },
        { kind: "select", key: "problem", label: "Problems", value: (r) => r.problem_category },
        { kind: "select", key: "branch", label: "Branches", value: (r) => r.branch },
        { kind: "toggle", key: "open", label: "Open only", test: (r) => !CLOSED_STATUSES.includes(r.status) },
        { kind: "toggle", key: "overdue", label: "Overdue", test: isOverdue },
        { kind: "toggle", key: "due", label: "Balance due", test: (r) => r.balance > 0 && r.status !== "Cancelled" },
        { kind: "dates", key: "opened", label: "Opened", value: (r) => r.created_at },
      ],
    },
    "repairs",
  );

  return (
    <>
      <PageHeader
        title="Repairs"
        action={
          <LinkButton href="/repairs/new" icon={<Plus />}>
            New Repair
          </LinkButton>
        }
      />
      <Panel>
        <Async data={data} error={error}>
          {() => (
            <>
              {bar}
              <DataTable
                rows={rows}
                rowKey={(r) => r.id}
                empty={filtering ? "No repairs match these filters." : "No repairs yet."}
                columns={[
                  col.ticket,
                  col.client,
                  col.device,
                  col.problem,
                  col.technician,
                  col.status,
                  col.balance,
                  { header: "Deadline", cell: (r) => <span className={isOverdue(r) ? "font-medium text-destructive" : undefined}>{r.deadline || "—"}</span> },
                ]}
              />
            </>
          )}
        </Async>
      </Panel>
    </>
  );
}
