"use client";

import { ApiForm, CheckboxField, Field, Panel, SelectField, SubmitButton, TextAreaField } from "@/components/kat";
import { api } from "@/lib/api";
import type { Person, Repair } from "@/lib/types";

type Props = { repair: Repair; statuses: string[]; technicians: Person[]; onChange: () => Promise<void> };

/** Status, technician, price, diagnosis and approval. Changing the status notifies the client. */
export function RepairUpdateForm({ repair: r, statuses, technicians, onChange }: Props) {
  return (
    <Panel title="Repair Update" description="Changing the status notifies the client.">
      {/* key: show the saved values again after each update */}
      <ApiForm key={r.updated_at} action={(v) => api(`/repairs/${r.id}`, { method: "PATCH", body: v })} onSuccess={onChange} success="Repair updated.">
        <SelectField label="Status" name="status" defaultValue={r.status} options={statuses} />
        <SelectField
          label="Technician"
          name="technician_id"
          defaultValue={r.technician_id ?? ""}
          placeholder="Unassigned"
          options={technicians.map((t) => ({ value: t.id, label: t.full_name }))}
        />
        <Field label="Quoted price" type="number" name="quoted_price" defaultValue={r.quoted_price} />
        <TextAreaField label="Diagnosis" name="diagnosis" defaultValue={r.diagnosis || ""} />
        <TextAreaField label="Work done" name="work_done" defaultValue={r.work_done || ""} />
        <CheckboxField label="Customer approved repair" name="approved" defaultChecked={r.approved} />
        <SubmitButton>Save Update</SubmitButton>
      </ApiForm>
    </Panel>
  );
}
