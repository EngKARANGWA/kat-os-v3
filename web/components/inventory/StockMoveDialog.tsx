"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, PackagePlus, TriangleAlert } from "lucide-react";
import { ApiForm, Field, ScanField, SelectField, SubmitButton } from "@/components/kat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { InventoryItem, StockMovement } from "@/lib/types";

type Mode = "in" | "out";
type Props = {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  reasons: string[];
  /** SKU to start with (from a row's In / Out button). */
  initialSku?: string;
  onSaved: () => Promise<void>;
  /** Check In only: the scanned SKU is not in stock yet. */
  onAddNew?: (sku: string) => void;
};

const TEXT = {
  in: { title: "Check In", verb: "checked in", desc: "Scan or type each item you received. The window stays open for the next scan.", icon: ArrowDownToLine, note: "Supplier / invoice no." },
  out: { title: "Check Out", verb: "checked out", desc: "Scan or type each item leaving stock and choose why. The window stays open for the next scan.", icon: ArrowUpFromLine, note: "Note (customer, details…)" },
};

/**
 * Check In / Check Out window. Scan → quantity → Enter, then the next scan.
 * "Used in repair" also asks for the repair ticket so the part is added to that repair's costs.
 */
export function StockMoveDialog({ mode, open, onOpenChange, items, reasons, initialSku = "", onSaved, onAddNew }: Props) {
  const t = TEXT[mode];
  const [sku, setSku] = useState(initialSku);
  const [reason, setReason] = useState(reasons[0] ?? "");
  const [round, setRound] = useState(0); // new key = fresh, empty form for the next scan
  const [prefilled, setPrefilled] = useState(false); // opened from a row: SKU known, cursor starts on Quantity
  const [done, setDone] = useState<{ name: string; quantity: number; after: number | null }[]>([]);
  const item = sku ? items.find((i) => i.sku.toLowerCase() === sku.toLowerCase()) : undefined;
  const forRepair = mode === "out" && reason === "Used in repair";

  // Start fresh every time the window opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSku(initialSku);
      setPrefilled(!!initialSku);
      setDone([]);
      setReason(reasons[0] ?? "");
      setRound((r) => r + 1);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <t.icon className={cn("size-5", mode === "in" ? "text-emerald-600" : "text-amber-600")} />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.desc}</DialogDescription>
        </DialogHeader>

        <ApiForm
          key={round}
          layout="grid"
          action={(v) => api<{ item: InventoryItem; movement: StockMovement }>("/inventory/check", { body: { ...v, direction: mode } })}
          success={({ item: it, movement: m }) => `${m.quantity} × ${it.name} ${t.verb} — now ${it.quantity} in stock.`}
          onSuccess={async ({ item: it, movement: m }) => {
            setDone((d) => [{ name: it.name, quantity: m.quantity, after: it.quantity }, ...d]);
            setSku("");
            setPrefilled(false);
            setRound((r) => r + 1); // clears the form and puts the cursor back on SKU
            await onSaved();
          }}
        >
          <div className="sm:col-span-2">
            <ScanField label="SKU" name="sku" required autoFocus={!prefilled} defaultValue={sku} placeholder="Scan or type the code" onCodeChange={setSku} />
          </div>

          {sku && !item && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm sm:col-span-2">
              <span className="text-muted-foreground">No stock item with this SKU yet.</span>
              {onAddNew && (
                <Button type="button" variant="outline" onClick={() => onAddNew(sku)}>
                  <PackagePlus />
                  Add as new item
                </Button>
              )}
            </div>
          )}
          {item && (
            <div role="status" data-testid="move-item" className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground sm:col-span-2">
              <div className="font-medium text-foreground">{item.name}</div>
              <div>
                {item.device_category} · {item.category} · <b>{item.quantity} in stock</b>
              </div>
              {mode === "out" && item.quantity === 0 && (
                <div className="mt-1 flex items-center gap-1 text-destructive">
                  <TriangleAlert className="size-3.5" /> Out of stock — nothing to check out.
                </div>
              )}
            </div>
          )}

          <Field label="Quantity" type="number" name="quantity" min={1} max={mode === "out" && item ? Math.max(item.quantity, 1) : undefined} defaultValue={1} required autoFocus={prefilled} />
          <SelectField label="Reason" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} options={reasons} />
          {forRepair && (
            <div className="sm:col-span-2">
              <ScanField label="Repair ticket" name="ticket_code" required placeholder="e.g. KAT012a" hint="The part is added to this repair and counted in its parts cost." />
            </div>
          )}
          <Field full label={t.note} name="note" />
          <SubmitButton full icon={<t.icon />} className={mode === "out" ? "bg-amber-600 hover:bg-amber-600/90" : "bg-emerald-600 hover:bg-emerald-600/90"}>
            {t.title}
          </SubmitButton>
        </ApiForm>

        {done.length > 0 && (
          <div className="rounded-lg border p-3">
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase">This session</div>
            <ul data-testid="move-session" className="flex flex-col gap-1 text-sm">
              {done.map((d, i) => (
                <li key={i}>
                  {mode === "in" ? "+" : "−"}
                  {d.quantity} × {d.name} <span className="text-muted-foreground">(now {d.after})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
