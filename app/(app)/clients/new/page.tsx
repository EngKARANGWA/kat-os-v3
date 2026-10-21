"use client";

import { useRouter } from "next/navigation";
import { ApiForm, Field, PageHeader, Panel, SubmitButton } from "@/components/kat";
import { useFlash } from "@/components/Flash";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";

export default function NewClientPage() {
  const router = useRouter();
  const flash = useFlash();

  return (
    <>
      <PageHeader title="Register Client" description="No National ID needed. After saving you can create the repair ticket straight away." />
      <Panel className="max-w-3xl">
        <ApiForm
          layout="grid"
          action={(v) => api<{ client: Client }>("/clients", { body: v })}
          onSuccess={({ client }) => {
            flash("Client registered.");
            router.push(`/repairs/new?client_id=${client.id}`);
          }}
        >
          <Field label="Full name" name="full_name" required />
          <Field label="Phone" name="phone" required type="tel" />
          <Field label="Email" type="email" name="email" />
          <Field label="Address" name="address" />
          <SubmitButton full>Save &amp; Create Repair</SubmitButton>
        </ApiForm>
      </Panel>
    </>
  );
}
