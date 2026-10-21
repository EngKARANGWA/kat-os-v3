"use client";

import { UserPlus } from "lucide-react";
import { ApiForm, Async, DataTable, Field, PageHeader, Panel, SelectField, SubmitButton, useFilters } from "@/components/kat";
import { Badge } from "@/components/ui/badge";
import { ManagerOnly } from "@/components/Session";
import { api, useApi } from "@/lib/api";
import type { Branch, User } from "@/lib/types";

function Users() {
  const { data, error, reload } = useApi<{ users: User[]; roles: string[] }>("/users");
  const { data: branches } = useApi<{ branches: Branch[] }>("/branches");
  const { rows, bar, filtering } = useFilters(
    data?.users ?? [],
    {
      placeholder: "Search name, username, email…",
      search: (u) => [u.full_name, u.username, u.work_email],
      filters: [
        { kind: "select", key: "role", label: "Roles", value: (u) => u.role, options: data?.roles },
        { kind: "select", key: "branch", label: "Branches", value: (u) => u.branch },
      ],
    },
    "users",
  );

  return (
    <Async data={data} error={error}>
      {(d) => (
        <>
          <Panel title="Create User" className="mb-6 max-w-4xl">
            <ApiForm layout="grid" action={(v) => api("/users", { body: v })} reset onSuccess={reload} success="User created.">
              <Field label="Full name" name="full_name" required />
              <Field label="Username" name="username" required autoComplete="off" />
              <Field label="Work email" type="email" name="work_email" placeholder="name@kat.com" />
              <Field label="Password" type="password" name="password" required autoComplete="new-password" />
              <SelectField label="Role" name="role" options={d.roles} />
              <SelectField label="Branch" name="branch_id" options={(branches?.branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
              <SubmitButton full icon={<UserPlus />}>
                Create User
              </SubmitButton>
            </ApiForm>
          </Panel>
          <Panel title="Staff">
            {bar}
            <DataTable
              rows={rows}
              rowKey={(u) => u.id}
              empty={filtering ? "No staff match these filters." : "No staff yet."}
              columns={[
                { header: "Name", cell: (u) => <span className="font-medium">{u.full_name}</span> },
                { header: "Username", cell: (u) => u.username },
                { header: "Email", cell: (u) => u.work_email || "—" },
                { header: "Role", cell: (u) => <Badge variant={u.is_manager ? "default" : "secondary"}>{u.role}</Badge> },
                { header: "Branch", cell: (u) => u.branch || "—" },
              ]}
            />
          </Panel>
        </>
      )}
    </Async>
  );
}

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Staff Users" />
      <ManagerOnly>
        <Users />
      </ManagerOnly>
    </>
  );
}
