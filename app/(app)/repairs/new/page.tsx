"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Phone, User } from "lucide-react";
import { ApiForm, Async, Field, Loading, PageHeader, Panel, SelectField, SubmitButton, TextAreaField } from "@/components/kat";
import { ClientPicker, type ClientOption } from "@/components/repairs/ClientPicker";
import { useFlash } from "@/components/Flash";
import { Button } from "@/components/ui/button";
import { api, useApi } from "@/lib/api";
import type { Branch, Person, RepairSummary } from "@/lib/types";

type Options = {
  clients: ClientOption[];
  technicians: Person[];
  branches: Branch[];
  terms: Record<string, string[]>;
};

function NewRepair() {
  const router = useRouter();
  const flash = useFlash();
  const fromUrl = Number(useSearchParams().get("client_id")) || null;
  const { data, error } = useApi<Options>("/repairs/options");
  const [pickedId, setPickedId] = useState<number | null>(null);
  const clientId = pickedId ?? fromUrl;

  function pick(c: ClientOption | null) {
    setPickedId(c?.id ?? null);
    // Keep the choice in the address, so a page refresh keeps it too.
    router.replace(c ? `/repairs/new?client_id=${c.id}` : "/repairs/new");
  }

  return (
    <Async data={data} error={error}>
      {(d) => {
        const client = d.clients.find((c) => c.id === clientId);

        // Step 1: the client must be chosen before the repair form appears.
        if (!client)
          return (
            <Panel title="1. Who is this repair for?" description="Choose the client first. Then the repair details." className="max-w-3xl">
              <ClientPicker clients={d.clients} onPick={pick} />
            </Panel>
          );

        // Step 2: the repair details.
        return (
          <Panel className="max-w-4xl">
            <div data-testid="repair-client" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary p-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-card text-primary">
                  <User className="size-4" />
                </span>
                <div>
                  <div className="text-xs text-secondary-foreground">Repair for</div>
                  <div className="font-medium text-foreground">{client.full_name}</div>
                  <div className="inline-flex items-center gap-1 text-secondary-foreground">
                    <Phone className="size-3" /> {client.phone}
                  </div>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => pick(null)}>
                Change client
              </Button>
            </div>

            <ApiForm
              key={client.id}
              layout="grid"
              action={(v) => api<{ repair: RepairSummary }>("/repairs", { body: { ...v, client_id: client.id } })}
              onSuccess={({ repair }) => {
                flash(`${repair.ticket_code} created.`);
                router.push(`/repairs/${repair.id}`);
              }}
            >
              <SelectField label="Branch" name="branch_id" options={d.branches.map((b) => ({ value: b.id, label: b.name }))} />
              <Field label="Device" name="device" placeholder="iPhone 15 Pro Max" required autoFocus />
              <Field label="IMEI / Serial" name="serial_imei" />
              <Field label="Device passcode (optional)" name="device_passcode" />
              <Field label="Accessories received" name="accessories" placeholder="Case, SIM, charger..." />
              <SelectField label="Problem category" name="problem_category" options={Object.keys(d.terms)} hint="The matching T&Cs are attached to the ticket." />
              <SelectField
                label="Technician"
                name="technician_id"
                placeholder="Unassigned"
                options={d.technicians.map((t) => ({ value: t.id, label: t.full_name }))}
              />
              <Field label="Quoted price RWF" type="number" name="quoted_price" min={0} />
              <Field label="Deadline" type="date" name="deadline" />
              <TextAreaField full label="Physical condition at intake" name="condition_in" rows={3} placeholder="Cracks, scratches, liquid signs..." />
              <TextAreaField full label="Problem notes" name="problem_notes" rows={3} />
              <Field
                full
                label="Customer acceptance / typed name"
                name="customer_acceptance"
                defaultValue={client.full_name}
                placeholder="Customer name confirming intake and applicable T&Cs"
              />
              <SubmitButton full>Create Ticket</SubmitButton>
            </ApiForm>
          </Panel>
        );
      }}
    </Async>
  );
}

export default function NewRepairPage() {
  return (
    <>
      <PageHeader title="New Repair Ticket" description="The client is notified when the ticket is created and each time its status changes." />
      <Suspense fallback={<Loading />}>
        <NewRepair />
      </Suspense>
    </>
  );
}
