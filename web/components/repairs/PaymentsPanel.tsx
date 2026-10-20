"use client";

import { Banknote } from "lucide-react";
import { ApiForm, Field, Panel, SelectField, SubmitButton } from "@/components/kat";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { fmtDay, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Repair } from "@/lib/types";

function Amount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex flex-col rounded-lg bg-muted/60 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-base font-semibold tabular-nums", strong && value > 0 && "text-destructive")}>{money(value)} RWF</span>
    </div>
  );
}

/** Quoted / paid / balance, the payment history, and the form to record a payment. */
export function PaymentsPanel({ repair: r, methods, onChange }: { repair: Repair; methods: string[]; onChange: () => Promise<void> }) {
  return (
    <Panel title="Payments">
      <div data-testid="payment-summary" className="grid grid-cols-3 gap-2">
        <Amount label="Quoted" value={r.quoted_price} />
        <Amount label="Paid" value={r.paid} />
        <Amount label="Balance" value={r.balance} strong />
      </div>
      {r.payments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
          {r.payments.map((p) => (
            <li key={p.id}>
              {fmtDay(p.paid_at)} — {money(p.amount)} RWF · {p.method}
            </li>
          ))}
        </ul>
      )}
      <Separator className="my-4" />
      <ApiForm action={(v) => api(`/repairs/${r.id}/payments`, { body: v })} reset onSuccess={onChange} success="Payment recorded.">
        <Field label="Amount" type="number" name="amount" min={1} required />
        <SelectField label="Method" name="method" options={methods} />
        <Field label="Reference" name="reference" />
        <SubmitButton icon={<Banknote />}>Record Payment</SubmitButton>
      </ApiForm>
    </Panel>
  );
}
