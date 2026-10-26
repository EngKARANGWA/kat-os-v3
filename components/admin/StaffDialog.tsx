"use client";

import { useEffect, useId, useState } from "react";
import { RotateCcw, ShieldCheck, UserCog, UserPlus } from "lucide-react";
import { ApiForm, Field, SelectField, SubmitButton } from "@/components/kat";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { Branch, Permission, User } from "@/lib/types";

export const MANAGER_ROLE = "General Manager";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The staff member to edit, or null to add a new one. */
  user: User | null;
  meId: number;
  roles: string[];
  permissions: Permission[];
  rolePermissions: Record<string, string[]>;
  branches: Branch[];
  onSaved: () => Promise<void> | void;
};

/** Pop-up to add or edit a staff member: details, role, and what they may use (ticks start from the role's defaults). */
export function StaffDialog({ open, onOpenChange, user, meId, roles, permissions, rolePermissions, branches, onSaved }: Props) {
  const [role, setRole] = useState(roles[0] ?? MANAGER_ROLE);
  const [perms, setPerms] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  // Start from the person being edited, or from the first role's defaults for a new person.
  useEffect(() => {
    if (!open) return;
    const r = user?.role ?? roles.find((x) => x !== MANAGER_ROLE) ?? roles[0];
    setRole(r);
    setPerms(user ? user.permissions : (rolePermissions[r] ?? []));
    setActive(user?.active ?? true);
  }, [open, user, roles, rolePermissions]);

  const manager = role === MANAGER_ROLE;
  const defaults = rolePermissions[role] ?? [];
  const isDefault = defaults.length === perms.length && defaults.every((k) => perms.includes(k));
  const self = user?.id === meId;
  const groups = [...new Set(permissions.map((p) => p.group))];

  function changeRole(r: string) {
    setRole(r);
    setPerms(rolePermissions[r] ?? []); // a new role starts from that role's defaults
  }

  const save = (v: Record<string, string>) => {
    const body = { ...v, role, permissions: perms, active };
    return user ? api(`/users/${user.id}`, { method: "PATCH", body }) : api("/users", { body });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {user ? <UserCog className="size-5 text-primary" /> : <UserPlus className="size-5 text-primary" />}
            {user ? `Edit ${user.full_name}` : "Add Staff"}
          </DialogTitle>
          <DialogDescription>{user ? "Change details, role and what they may use." : "Create a login for a staff member and choose what they may use."}</DialogDescription>
        </DialogHeader>

        <ApiForm
          key={user?.id ?? "new"}
          layout="grid"
          action={save}
          onSuccess={async () => {
            onOpenChange(false);
            await onSaved();
          }}
          success={user ? "Staff member updated." : "Staff member created."}
        >
          <Field label="Full name" name="full_name" required autoFocus defaultValue={user?.full_name} />
          <Field label="Username" name="username" required autoComplete="off" defaultValue={user?.username} />
          <Field label="Work email" type="email" name="work_email" placeholder="name@kat.com" defaultValue={user?.work_email ?? ""} />
          <Field
            label="Password"
            type="password"
            name="password"
            required={!user}
            minLength={6}
            autoComplete="new-password"
            placeholder={user ? "Leave empty to keep the current one" : "At least 6 characters"}
          />
          <SelectField label="Role" name="role" options={roles} value={role} onChange={(e) => changeRole(e.target.value)} disabled={self} hint={self ? "You cannot change your own role." : undefined} />
          <SelectField
            label="Branch"
            name="branch_id"
            placeholder="No branch"
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            defaultValue={user?.branch_id ?? branches[0]?.id ?? ""}
          />

          <fieldset className="flex flex-col gap-3 rounded-lg border p-4 sm:col-span-2">
            <legend className="px-1 text-sm font-medium">Permissions</legend>
            {manager ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" />
                The General Manager can use everything, including Users, Branches and the Audit Log.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span data-testid="permission-count">
                    {perms.length} of {permissions.length} allowed · {isDefault ? `${role} defaults` : "custom"}
                  </span>
                  {!isDefault && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPerms(defaults)}>
                      <RotateCcw />
                      Use {role} defaults
                    </Button>
                  )}
                </div>
                {groups.map((g) => (
                  <div key={g} className="flex flex-col gap-2">
                    <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{g}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {permissions
                        .filter((p) => p.group === g)
                        .map((p) => (
                          <PermissionBox
                            key={p.key}
                            permission={p}
                            checked={perms.includes(p.key)}
                            onChange={(on) => setPerms((cur) => (on ? permissions.map((x) => x.key).filter((k) => k === p.key || cur.includes(k)) : cur.filter((k) => k !== p.key)))}
                          />
                        ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Users, Branches and the Audit Log are for the General Manager only.</p>
              </>
            )}
          </fieldset>

          {user && !self && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} aria-label="Active (can sign in)" />
              Active — can sign in. Untick to block this login without deleting the history.
            </label>
          )}

          <SubmitButton full icon={user ? <UserCog /> : <UserPlus />}>
            {user ? "Save Changes" : "Create Staff Member"}
          </SubmitButton>
        </ApiForm>
      </DialogContent>
    </Dialog>
  );
}

function PermissionBox({ permission, checked, onChange }: { permission: Permission; checked: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 rounded-md border p-3 has-data-checked:border-primary/40 has-data-checked:bg-secondary/50">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <Label htmlFor={id} className="flex flex-col items-start gap-0.5 font-normal">
        <span className="font-medium">{permission.label}</span>
        <span className="text-xs text-muted-foreground">{permission.description}</span>
      </Label>
    </div>
  );
}
