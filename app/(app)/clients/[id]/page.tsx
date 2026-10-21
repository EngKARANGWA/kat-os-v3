"use client";

import { useParams } from "next/navigation";
import { Mail, MapPin, Phone, Plus } from "lucide-react";
import { Async, DataTable, LinkButton, PageHeader, Panel, TwoColumns } from "@/components/kat";
import { ClientDevices } from "@/components/clients/ClientDevices";
import { ClientNotes, type Note } from "@/components/clients/ClientNotes";
import { repairColumns as col } from "@/components/repairs/columns";
import { useApi } from "@/lib/api";
import type { Client, Device, RepairSummary } from "@/lib/types";

type Detail = { client: Client; notes: Note[]; devices: Device[]; repairs: RepairSummary[] };

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useApi<Detail>(`/clients/${id}`);

  return (
    <Async data={data} error={error}>
      {({ client: c, notes, devices, repairs }) => (
        <>
          <PageHeader
            title={c.full_name}
            description={
              <span className="flex flex-wrap gap-x-5 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {c.phone}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {c.email || "No email"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {c.address || "No address"}
                </span>
              </span>
            }
            action={
              <LinkButton href={`/repairs/new?client_id=${c.id}`} icon={<Plus />}>
                New Repair
              </LinkButton>
            }
          />
          <TwoColumns
            left={
              <>
                <ClientDevices clientId={c.id} clientName={c.full_name} devices={devices} onChange={reload} />
                <Panel title="Repair History">
                  <DataTable rows={repairs} rowKey={(r) => r.id} empty="No repairs yet." columns={[col.ticket, col.device, col.status, col.date]} />
                </Panel>
              </>
            }
            right={<ClientNotes clientId={c.id} notes={notes} onChange={reload} />}
          />
        </>
      )}
    </Async>
  );
}
