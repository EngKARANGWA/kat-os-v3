"use client";

import { Async, DataTable, PageHeader, Panel, useFilters } from "@/components/kat";
import { ManagerOnly } from "@/components/Session";
import { useApi } from "@/lib/api";
import { fmtDay } from "@/lib/format";

type Log = { id: number; user_name: string; action: string; entity: string; entity_id: number | null; created_at: string };

function AuditLog() {
  const { data, error } = useApi<{ logs: Log[] }>("/audit");
  const { rows, bar, filtering } = useFilters(
    data?.logs ?? [],
    {
      placeholder: "Search action, staff, record…",
      search: (l) => [l.action, l.user_name, l.entity, l.entity_id],
      filters: [
        { kind: "select", key: "user", label: "Staff", value: (l) => l.user_name },
        { kind: "select", key: "entity", label: "Record types", value: (l) => l.entity },
        { kind: "dates", key: "date", label: "Date", value: (l) => l.created_at },
      ],
    },
    "audit",
  );

  return (
    <Panel>
      <Async data={data} error={error}>
        {() => (
          <>
            {bar}
            <DataTable
              rows={rows}
              rowKey={(l) => l.id}
              empty={filtering ? "No actions match these filters." : "No actions recorded yet."}
              columns={[
                { header: "Date", cell: (l) => <span className="whitespace-nowrap">{`${fmtDay(l.created_at)} ${l.created_at.slice(11, 16)}`}</span> },
                { header: "User", cell: (l) => <span className="font-medium">{l.user_name}</span> },
                { header: "Action", cell: (l) => l.action },
                { header: "Entity", cell: (l) => <span className="text-muted-foreground">{`${l.entity} #${l.entity_id ?? ""}`}</span> },
              ]}
            />
          </>
        )}
      </Async>
    </Panel>
  );
}

export default function AuditPage() {
  return (
    <>
      <PageHeader title="Audit Log" description="The last 2,000 actions taken by staff." />
      <ManagerOnly>
        <AuditLog />
      </ManagerOnly>
    </>
  );
}
