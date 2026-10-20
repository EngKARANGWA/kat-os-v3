"use client";

import { Building2, Plus } from "lucide-react";
import { ApiForm, Async, Field, PageHeader, Panel, SubmitButton } from "@/components/kat";
import { ManagerOnly } from "@/components/Session";
import { api, useApi } from "@/lib/api";
import type { Branch } from "@/lib/types";

function Branches() {
  const { data, error, reload } = useApi<{ branches: Branch[] }>("/branches");

  return (
    <>
      <Panel title="Add Branch" className="mb-6">
        <ApiForm layout="inline" action={(v) => api("/branches", { body: v })} reset onSuccess={reload} success="Branch added.">
          <Field label="Branch name" name="name" placeholder="Branch name" required />
          <Field label="Location" name="location" placeholder="Location" />
          <Field label="Phone" name="phone" placeholder="Phone" />
          <SubmitButton icon={<Plus />}>Add</SubmitButton>
        </ApiForm>
      </Panel>
      <Async data={data} error={error}>
        {(d) => (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {d.branches.map((b) => (
              <Panel
                key={b.id}
                title={
                  <span className="flex items-center gap-2">
                    <Building2 className="size-4 text-primary" />
                    {b.name}
                  </span>
                }
              >
                <p className="text-sm text-muted-foreground">
                  {b.location || "—"} · {b.phone || "—"}
                </p>
              </Panel>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}

export default function BranchesPage() {
  return (
    <>
      <PageHeader title="Branches" />
      <ManagerOnly>
        <Branches />
      </ManagerOnly>
    </>
  );
}
