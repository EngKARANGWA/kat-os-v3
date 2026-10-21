"use client";

import { useParams } from "next/navigation";
import { Download } from "lucide-react";
import { Async, LinkButton, PageHeader, TwoColumns } from "@/components/kat";
import { PartsPanel } from "@/components/repairs/PartsPanel";
import { PaymentsPanel } from "@/components/repairs/PaymentsPanel";
import { RepairInfo } from "@/components/repairs/RepairInfo";
import { RepairUpdateForm } from "@/components/repairs/RepairUpdateForm";
import { useApi } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { Person, Repair } from "@/lib/types";

type Detail = {
  repair: Repair;
  statuses: string[];
  payment_methods: string[];
  technicians: Person[];
  inventory: { id: number; name: string; quantity: number }[];
};

export default function RepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useApi<Detail>(`/repairs/${id}`);

  return (
    <Async data={data} error={error}>
      {(d) => (
        <>
          <PageHeader
            title={d.repair.ticket_code}
            description={`Opened ${fmtDate(d.repair.created_at)}${d.repair.branch ? ` · ${d.repair.branch}` : ""}`}
            action={
              <LinkButton native href={`/api/repairs/${d.repair.id}/ticket.pdf`} variant="outline" icon={<Download />}>
                Download Ticket PDF
              </LinkButton>
            }
          />
          <TwoColumns
            left={
              <>
                <RepairInfo repair={d.repair} />
                <PartsPanel repair={d.repair} inventory={d.inventory} onChange={reload} />
              </>
            }
            right={
              <>
                <RepairUpdateForm repair={d.repair} statuses={d.statuses} technicians={d.technicians} onChange={reload} />
                <PaymentsPanel repair={d.repair} methods={d.payment_methods} onChange={reload} />
              </>
            }
          />
        </>
      )}
    </Async>
  );
}
