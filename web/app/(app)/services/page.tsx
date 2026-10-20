"use client";

import { Plus } from "lucide-react";
import { ApiForm, Async, DataTable, Field, PageHeader, Panel, SubmitButton, useFilters } from "@/components/kat";
import { api, useApi } from "@/lib/api";
import { money } from "@/lib/format";

type Service = { id: number; name: string; price: number; warranty_days: number };

export default function ServicesPage() {
  const { data, error, reload } = useApi<{ services: Service[] }>("/services");
  const { rows, bar, filtering } = useFilters(data?.services ?? [], { placeholder: "Search services…", search: (s) => [s.name, s.price] }, "services");

  return (
    <>
      <PageHeader title="Services & Prices" />
      <Panel title="Add Service" className="mb-6">
        <ApiForm layout="inline" action={(v) => api("/services", { body: v })} reset onSuccess={reload} success="Service added.">
          <Field label="Service" name="name" placeholder="Service" required />
          <Field label="Price (RWF)" type="number" name="price" placeholder="Price" />
          <Field label="Warranty days" type="number" name="warranty_days" defaultValue={21} />
          <SubmitButton icon={<Plus />}>Add</SubmitButton>
        </ApiForm>
      </Panel>
      <Panel>
        <Async data={data} error={error}>
          {() => (
            <>
              {bar}
              <DataTable
                rows={rows}
                rowKey={(s) => s.id}
                empty={filtering ? "No services match." : "No services yet."}
                columns={[
                  { header: "Service", cell: (s) => <span className="font-medium">{s.name}</span> },
                  { header: "Price", cell: (s) => `${money(s.price)} RWF` },
                  { header: "Warranty", cell: (s) => `${s.warranty_days} days` },
                ]}
              />
            </>
          )}
        </Async>
      </Panel>
    </>
  );
}
