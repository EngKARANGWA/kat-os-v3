"use client";

import { useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { Async, DataTable, PageHeader, Panel, useFilters } from "@/components/kat";
import { StaffDialog } from "@/components/admin/StaffDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ManagerOnly, useMe } from "@/components/Session";
import { useApi } from "@/lib/api";
import type { Branch, Permission, User } from "@/lib/types";

type UsersData = { users: User[]; roles: string[]; permissions: Permission[]; role_permissions: Record<string, string[]> };

function Users() {
  const me = useMe();
  const { data, error, reload } = useApi<UsersData>("/users");
  const { data: branches } = useApi<{ branches: Branch[] }>("/branches");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const { rows, bar, filtering } = useFilters(
    data?.users ?? [],
    {
      placeholder: "Search name, username, email…",
      search: (u) => [u.full_name, u.username, u.work_email],
      filters: [
        { kind: "select", key: "role", label: "Roles", value: (u) => u.role, options: data?.roles },
        { kind: "select", key: "branch", label: "Branches", value: (u) => u.branch },
        { kind: "select", key: "status", label: "Statuses", value: (u) => (u.active ? "Active" : "Inactive"), options: ["Active", "Inactive"] },
      ],
    },
    "users",
  );

  function openDialog(u: User | null) {
    setEditing(u);
    setOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Staff Users"
        description="Who can sign in, their role, and what each person may use."
        action={
          <Button size="lg" onClick={() => openDialog(null)}>
            <UserPlus />
            Add Staff
          </Button>
        }
      />
      <Async data={data} error={error}>
        {(d) => {
          const label = (k: string) => d.permissions.find((p) => p.key === k)?.label ?? k;
          return (
            <>
              <Panel title="Staff">
                {bar}
                <DataTable
                  rows={rows}
                  rowKey={(u) => u.id}
                  empty={filtering ? "No staff match these filters." : "No staff yet. Click “Add Staff”."}
                  columns={[
                    {
                      header: "Name",
                      cell: (u) => (
                        <span className="flex items-center gap-2 font-medium">
                          {u.full_name}
                          {!u.active && <Badge variant="outline">Inactive</Badge>}
                        </span>
                      ),
                    },
                    { header: "Username", cell: (u) => u.username },
                    { header: "Email", cell: (u) => u.work_email || "—" },
                    { header: "Role", cell: (u) => <Badge variant={u.is_manager ? "default" : "secondary"}>{u.role}</Badge> },
                    {
                      header: "Permissions",
                      cell: (u) =>
                        u.is_manager ? (
                          <span className="text-xs font-medium text-primary">Full access</span>
                        ) : (
                          <span className="flex flex-col gap-0.5 text-xs" title={u.permissions.map(label).join(", ")}>
                            <span className="font-medium">
                              {u.permissions.length} of {d.permissions.length}
                              {u.custom_permissions && <span className="ml-1 text-muted-foreground">(custom)</span>}
                            </span>
                            <span className="line-clamp-1 max-w-56 text-muted-foreground">{u.permissions.map(label).join(", ") || "Nothing"}</span>
                          </span>
                        ),
                    },
                    { header: "Branch", cell: (u) => u.branch || "—" },
                    {
                      header: "",
                      cell: (u) => (
                        <Button variant="outline" size="sm" onClick={() => openDialog(u)} aria-label={`Edit ${u.full_name}`}>
                          <Pencil />
                          Edit
                        </Button>
                      ),
                    },
                  ]}
                />
              </Panel>
              <StaffDialog
                open={open}
                onOpenChange={setOpen}
                user={editing}
                meId={me.id}
                roles={d.roles}
                permissions={d.permissions}
                rolePermissions={d.role_permissions}
                branches={branches?.branches ?? []}
                onSaved={reload}
              />
            </>
          );
        }}
      </Async>
    </>
  );
}

export default function UsersPage() {
  return (
    <ManagerOnly>
      <Users />
    </ManagerOnly>
  );
}
