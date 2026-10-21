"use client";

import { FileText } from "lucide-react";
import { Async, DataTable, PageHeader, Panel, useFilters } from "@/components/kat";
import { repairColumns as col } from "@/components/repairs/columns";
import { useApi } from "@/lib/api";
import { REPAIR_STATUSES } from "@/lib/constants";
import { docSlug } from "@/lib/format";
import type { RepairSummary } from "@/lib/types";

/** The eight PDF downloads for one repair. */
function DocumentLinks({ repairId, types }: { repairId: number; types: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map((d) => (
        <a
          key={d}
          href={`/api/repairs/${repairId}/documents/${docSlug(d)}.pdf`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs whitespace-nowrap transition-colors hover:border-primary hover:text-primary"
        >
          <FileText className="size-3" />
          {d}
        </a>
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  const { data, error } = useApi<{ repairs: RepairSummary[]; document_types: string[] }>("/documents");
  const { rows, bar, filtering } = useFilters(
    data?.repairs ?? [],
    {
      placeholder: "Search ticket, client, phone, device, IMEI…",
      search: (r) => [r.ticket_code, r.client_name, r.client_phone, r.device, r.serial_imei],
      filters: [
        { kind: "select", key: "status", label: "Statuses", value: (r) => r.status, options: REPAIR_STATUSES },
        { kind: "dates", key: "opened", label: "Opened", value: (r) => r.created_at },
      ],
    },
    "documents",
  );

  return (
    <>
      <PageHeader title="Documents Chamber" description="Generate the eight standard KAT documents (PDF) from an existing repair ticket." />
      <Panel>
        <Async data={data} error={error}>
          {(d) => (
            <>
              {bar}
              <DataTable
                rows={rows}
                rowKey={(r) => r.id}
                empty={filtering ? "No tickets match these filters." : "No repairs yet."}
                columns={[
                  col.ticketText,
                  col.client,
                  col.device,
                  col.status,
                  { header: "Documents", cell: (r) => <DocumentLinks repairId={r.id} types={d.document_types} /> },
                ]}
              />
            </>
          )}
        </Async>
      </Panel>
    </>
  );
}
