"use client";

import { useState } from "react";
import { PackagePlus, Plus } from "lucide-react";
import { ApiForm, Field, ScanField, SelectField, SubmitButton } from "@/components/kat";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { DEVICE_CATEGORIES, PART_CATEGORIES } from "@/lib/constants";
import type { Branch, InventoryItem } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  branches: Branch[];
  /** SKU to start with (e.g. an unknown code scanned during Check In). */
  initialSku?: string;
  onSaved: () => Promise<void>;
};

/**
 * "Add Stock" pop-up form for a new stock item. The SKU can be typed, scanned with a USB scanner, or read with the camera.
 * If the SKU is already in stock, the form switches to adding quantity to that item instead of creating a duplicate.
 */
export function AddStockDialog({ open, onOpenChange, items, branches, initialSku = "", onSaved }: Props) {
  const [sku, setSku] = useState(initialSku);
  const [session, setSession] = useState(0); // new key each time it opens = fresh form
  const existing = sku ? items.find((i) => i.sku.toLowerCase() === sku.toLowerCase()) : undefined;

  // Start fresh every time the window opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSku(initialSku);
      setSession((s) => s + 1);
    }
  }

  async function save(v: Record<string, string>) {
    if (existing) {
      const r = await api<{ item: InventoryItem }>("/inventory/check", { body: { direction: "in", sku: existing.sku, quantity: v.quantity, reason: "Received from supplier" } });
      return `Added ${v.quantity} × ${existing.name} (now ${r.item.quantity} in stock).`;
    }
    await api("/inventory", { body: v });
    return "Stock item added.";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="size-5 text-primary" />
            Add Stock
          </DialogTitle>
          <DialogDescription>Scan the product&apos;s QR code or barcode, or type the SKU.</DialogDescription>
        </DialogHeader>

        <ApiForm
          key={session}
          layout="grid"
          action={save}
          success={(message) => message}
          onSuccess={async () => {
            onOpenChange(false);
            await onSaved();
          }}
        >
          <div className="sm:col-span-2">
            <ScanField
              label="SKU"
              name="sku"
              required
              autoFocus={!initialSku}
              defaultValue={initialSku}
              placeholder="Scan or type the code"
              hint="With a USB scanner, just scan: the code is filled in and the next field is selected."
              onCodeChange={setSku}
            />
          </div>

          {existing ? (
            <>
              <div role="status" className="rounded-lg border border-primary/30 bg-secondary p-3 text-sm text-secondary-foreground sm:col-span-2">
                <b>Already in stock:</b> {existing.name} ({existing.device_category} · {existing.category}) — {existing.quantity} in stock.
                <br />
                Enter how many you received to add them to this item.
              </div>
              <Field label="Quantity to add" type="number" name="quantity" min={1} defaultValue={1} required />
              <div className="flex items-end">
                <SubmitButton icon={<Plus />}>Add to Stock</SubmitButton>
              </div>
            </>
          ) : (
            <>
              <Field full label="Part / Product" name="name" required placeholder="e.g. iPhone 13 Pro Screen" autoFocus={!!initialSku} />
              <SelectField label="Device Category" name="device_category" options={DEVICE_CATEGORIES} />
              <SelectField label="Part Type" name="category" options={PART_CATEGORIES} />
              <Field label="Supplier / Source" name="supplier" />
              <Field label="Compatible models" name="compatible_models" placeholder="e.g. iPhone 13 Pro, 13 Pro Max" />
              <Field label="Quantity" type="number" name="quantity" defaultValue={1} min={0} />
              <Field label="Reorder level" type="number" name="reorder_level" defaultValue={2} min={0} hint="Flagged as Low at or below this." />
              <Field label="Cost price (RWF)" type="number" name="cost_price" min={0} />
              <Field label="Selling price (RWF)" type="number" name="selling_price" min={0} />
              <SelectField full label="Branch" name="branch_id" options={branches.map((b) => ({ value: b.id, label: b.name }))} />
              <SubmitButton full icon={<Plus />}>
                Add Stock Item
              </SubmitButton>
            </>
          )}
        </ApiForm>
      </DialogContent>
    </Dialog>
  );
}
