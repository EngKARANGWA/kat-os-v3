"use client";

import { PackageMinus } from "lucide-react";
import { ApiForm, Input, Panel, Select, SubmitButton } from "@/components/kat";
import { api } from "@/lib/api";
import type { Repair } from "@/lib/types";

type StockOption = { id: number; name: string; quantity: number };

/** Parts used on a repair, and the form to take a part out of stock. */
export function PartsPanel({ repair, inventory, onChange }: { repair: Repair; inventory: StockOption[]; onChange: () => Promise<void> }) {
  return (
    <Panel title="Parts Used">
      {repair.parts_used.length ? (
        <ul className="mb-4 flex flex-col gap-1 text-sm">
          {repair.parts_used.map((p) => (
            <li key={p.id}>
              {p.quantity} × {p.item_name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">None.</p>
      )}
      <ApiForm
        layout="inline"
        action={(v) => api(`/repairs/${repair.id}/parts`, { body: v })}
        onSuccess={onChange}
        success="Part deducted from inventory."
      >
        <Select name="item_id" required aria-label="Stock item" options={inventory.map((i) => ({ value: i.id, label: `${i.name} (${i.quantity})` }))} />
        <Input type="number" name="quantity" defaultValue={1} min={1} aria-label="Quantity" className="h-10 w-24 flex-none" />
        <SubmitButton icon={<PackageMinus />}>Use Part</SubmitButton>
      </ApiForm>
    </Panel>
  );
}
