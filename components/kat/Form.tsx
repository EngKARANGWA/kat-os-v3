"use client";

import { createContext, useContext, useId, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFlash } from "@/components/Flash";
import { formValues } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

const BusyContext = createContext(false);

const LAYOUTS = {
  stack: "flex flex-col gap-4",
  grid: "grid gap-4 sm:grid-cols-2",
  inline: "flex flex-wrap items-end gap-3 [&>*]:min-w-32 [&>*:first-child]:flex-1",
};

type ApiFormProps<R> = {
  /** Send the form values to the API. Throwing shows the error message. */
  action: (values: Record<string, string>) => Promise<R>;
  /** Message shown after a successful save. */
  success?: string | ((result: R) => string);
  /** Clear the fields after a successful save. */
  reset?: boolean;
  /** Runs after a successful save (e.g. reload data or go to another page), before the message is shown. */
  onSuccess?: (result: R) => void | Promise<void>;
  /** stack = one field per row, grid = two columns, inline = one row (wraps on phones). */
  layout?: keyof typeof LAYOUTS;
  className?: string;
  children: React.ReactNode;
};

/**
 * A form that saves through the API. Handles submit, the busy state of <SubmitButton>,
 * and success/error messages, so pages only describe the fields and what to call.
 */
export function ApiForm<R>({ action, success, reset, onSuccess, layout = "stack", className, children }: ApiFormProps<R>) {
  const flash = useFlash();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      const result = await action(formValues(form));
      if (reset) form.reset();
      await onSuccess?.(result);
      if (success) flash(typeof success === "function" ? success(result) : success, "success");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not save.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BusyContext.Provider value={busy}>
      <form className={cn(LAYOUTS[layout], className)} onSubmit={submit}>
        {children}
      </form>
    </BusyContext.Provider>
  );
}

/** Submit button that shows a spinner and is disabled while its <ApiForm> is saving. */
export function SubmitButton({ children, full, icon, className }: { children: React.ReactNode; full?: boolean; icon?: React.ReactNode; className?: string }) {
  const busy = useContext(BusyContext);
  return (
    <Button type="submit" disabled={busy} full={full} className={cn("self-end sm:self-auto", !full && "sm:w-fit", className)}>
      {busy ? <LoaderCircle className="animate-spin" /> : icon}
      {children}
    </Button>
  );
}

type Wrapper = { label: React.ReactNode; full?: boolean; hint?: React.ReactNode };

/** Label + control, with an optional hint underneath. `full` spans both columns of a grid form. */
function FieldShell({ id, label, full, hint, children }: Wrapper & { id: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2", full && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Labelled input (shadcn/ui Input). All normal <input> props work (name, type, required…). */
export function Field({ label, full, hint, className, ...input }: Wrapper & React.ComponentProps<"input">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} full={full} hint={hint}>
      <Input id={id} className={cn("h-10", className)} {...input} />
    </FieldShell>
  );
}

export function TextAreaField({ label, full, hint, ...textarea }: Wrapper & React.ComponentProps<"textarea">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} full={full} hint={hint}>
      <Textarea id={id} {...textarea} />
    </FieldShell>
  );
}

export type Option = string | { value: string | number; label: string };
type SelectProps = { options: Option[]; placeholder?: string } & Omit<React.ComponentProps<"select">, "size">;

/** Dropdown (shadcn/ui NativeSelect — the phone's own picker on mobile). `placeholder` adds an empty first choice. */
export function Select({ options, placeholder, className, ...select }: SelectProps) {
  return (
    <NativeSelect className={cn("w-full [&_select]:h-10", className)} {...select}>
      {placeholder !== undefined && <NativeSelectOption value="">{placeholder}</NativeSelectOption>}
      {options.map((o) =>
        typeof o === "string" ? (
          <NativeSelectOption key={o}>{o}</NativeSelectOption>
        ) : (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ),
      )}
    </NativeSelect>
  );
}

export function SelectField({ label, full, hint, ...select }: Wrapper & SelectProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} full={full} hint={hint}>
      <Select id={id} {...select} />
    </FieldShell>
  );
}

/** Checkbox (shadcn/ui) with its label. Sends "on" when ticked, like a normal checkbox. */
export function CheckboxField({ label, name, defaultChecked }: { label: React.ReactNode; name: string; defaultChecked?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} name={name} defaultChecked={defaultChecked} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

export { Input, Textarea };
