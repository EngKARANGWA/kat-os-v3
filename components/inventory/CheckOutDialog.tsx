"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowUpFromLine, Boxes, CircleAlert, CircleCheck, Download, LoaderCircle, Plus, Receipt, ShoppingCart, Wrench, X } from "lucide-react";
import { BarcodeScanner } from "@/components/kat";
import { useFlash } from "@/components/Flash";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api";
import { beep } from "@/lib/beep";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InventoryItem, OutCode, Sale } from "@/lib/types";
import { ScanInput, type ScanInputHandle } from "./ScanInput";

type Purpose = "sale" | "repair";
type Mode = "piece" | "box" | "items";
type Line = OutCode & { mode: Mode; quantity: number; device_serial: string };
type Feedback = { kind: "ok" | "error"; text: string } | null;
type Service = { id: number; name: string; price: number };
/** One stock line in the "Available stock" box: now → after this checkout (pieces, or items in boxes). */
type Avail = { id: number; name: string; unit: "piece" | "box"; now: number; after: number; boxesNow: number; boxesAfter: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  paymentMethods: string[];
  /** Current stock, to show what will be left after this checkout. */
  items: InventoryItem[];
  onSaved: () => Promise<void>;
};

const lineName = (l: Line) => (l.mode === "piece" ? l.product_name : l.mode === "box" ? `${l.product_name} — whole box${l.opened ? " (opened)" : ""}` : `${l.product_name} — from box`);

/** Starts a download of the receipt PDF without leaving the page. */
function downloadReceipt(sale: Sale) {
  const a = document.createElement("a");
  a.href = `/api/sales/${sale.id}/receipt.pdf`;
  a.download = `${sale.number}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Check Out by scanning the codes given at Check In: for a sale, or for a repair (with a service).
 * Boxes: take the whole box or some items from it. Ends with a receipt (PDF) showing each item,
 * its price per item and the device serial number, the total items and the amount to pay.
 */
export function CheckOutDialog({ open, onOpenChange, services, paymentMethods, items, onSaved }: Props) {
  const flash = useFlash();
  const [purpose, setPurpose] = useState<Purpose>("sale");
  const [serviceId, setServiceId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pendingBox, setPendingBox] = useState<OutCode | null>(null);
  const [boxItems, setBoxItems] = useState("1");
  const [customer, setCustomer] = useState({ name: "", phone: "", payment: "" });
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [camera, setCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Sale | null>(null);
  const [pending, setPending] = useState(false); // something typed in the scan box but not added yet
  const scanRef = useRef<ScanInputHandle>(null);
  const seen = useRef(new Set<string>()); // codes in this checkout, updated at once on every scan
  const pendingRef = useRef<OutCode | null>(null);
  pendingRef.current = pendingBox;

  // Fresh checkout every time the window opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPurpose("sale");
      setServiceId("");
      setLines([]);
      setPendingBox(null);
      setCustomer({ name: "", phone: "", payment: paymentMethods[0] ?? "Cash" });
      setFeedback(null);
      setDone(null);
      setPending(false);
      seen.current = new Set();
    }
  }

  const service = services.find((s) => String(s.id) === serviceId);
  const itemsTotal = lines.reduce((n, l) => n + l.quantity, 0);
  const productsTotal = lines.reduce((n, l) => n + l.quantity * l.price_per_item, 0);
  const amountToPay = productsTotal + (purpose === "repair" && service ? service.price : 0);
  const canScan = purpose === "sale" || !!service;
  // Available now → after this checkout, for every stock line scanned so far.
  const availability = Array.from(new Set(lines.map((l) => l.item_id))).flatMap((id): Avail[] => {
    const item = items.find((i) => i.id === id);
    if (!item) return [];
    const mine = lines.filter((l) => l.item_id === id);
    if (item.unit === "box") {
      const itemsNow = item.available_items ?? item.quantity * (item.items_per_box ?? 1);
      const taken = mine.reduce((n, l) => n + l.quantity, 0);
      const boxesEmptied = mine.filter((l) => l.mode === "box" || l.quantity >= l.items_left).length;
      return [{ id, name: mine[0].product_name, unit: "box", now: itemsNow, after: itemsNow - taken, boxesNow: item.quantity, boxesAfter: item.quantity - boxesEmptied }];
    }
    return [{ id, name: mine[0].product_name, unit: "piece", now: item.quantity, after: item.quantity - mine.length, boxesNow: 0, boxesAfter: 0 }];
  });
  const focusScan = () => setTimeout(() => scanRef.current?.focus(), 0);

  const addCode = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    if (pendingRef.current) {
      beep("error");
      setFeedback({ kind: "error", text: `First choose Whole box or Items from box for ${pendingRef.current.code}.` });
      return;
    }
    const key = code.toLowerCase();
    if (seen.current.has(key)) {
      beep("error");
      setFeedback({ kind: "error", text: `Already scanned: ${code} — not counted again.` });
      return;
    }
    seen.current.add(key);
    try {
      const { code: info } = await api<{ code: OutCode }>("/inventory/codes/out-lookup", { body: { code } });
      beep("ok");
      if (info.unit === "box") {
        setPendingBox(info);
        setBoxItems("1");
        setFeedback({ kind: "ok", text: `Box ${info.code}: ${info.items_left} items left — choose Whole box or Items from box.` });
      } else {
        setLines((list) => [{ ...info, mode: "piece", quantity: 1, device_serial: "" }, ...list]);
        setFeedback({ kind: "ok", text: `Scanned: ${info.code} — ${info.product_name}` });
      }
    } catch (err) {
      seen.current.delete(key);
      beep("error");
      setFeedback({ kind: "error", text: err instanceof ApiError ? err.message : "Could not check that code." });
    }
  }, []);

  function takeBox(mode: "box" | "items") {
    const box = pendingBox;
    if (!box) return;
    const qty = mode === "box" ? box.items_left : Math.floor(Number(boxItems));
    if (mode === "items" && (!qty || qty < 1 || qty > box.items_left)) {
      setFeedback({ kind: "error", text: `Take between 1 and ${box.items_left} items from box ${box.code}.` });
      return;
    }
    setLines((list) => [{ ...box, mode, quantity: qty, device_serial: "" }, ...list]);
    setPendingBox(null);
    setFeedback({ kind: "ok", text: mode === "box" ? `Whole box ${box.code} added (${qty} items).` : `${qty} items from box ${box.code} added.` });
    focusScan();
  }

  function removeLine(code: string) {
    seen.current.delete(code.toLowerCase());
    setLines((list) => list.filter((l) => l.code !== code));
  }

  function close(next: boolean) {
    if (!next && !done && (lines.length || pendingBox) && !saving && !window.confirm("Discard this checkout? Nothing has been taken out of stock yet.")) return;
    onOpenChange(next);
  }

  async function finish() {
    setSaving(true);
    try {
      const { sale } = await api<{ sale: Sale }>("/sales", {
        body: {
          purpose,
          service_id: purpose === "repair" ? serviceId : undefined,
          customer_name: customer.name,
          customer_phone: customer.phone,
          payment_method: customer.payment,
          lines: lines.map((l) => ({ code: l.code, mode: l.mode, quantity: l.quantity, device_serial: l.device_serial })),
        },
      });
      setDone(sale);
      flash(`Receipt ${sale.number} created — ${money(sale.total)} RWF.`);
      downloadReceipt(sale);
      await onSaved();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not check out.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="size-5 text-amber-600" />
            Check Out
          </DialogTitle>
          <DialogDescription>Scan the codes given at Check In, one by one. A receipt is made at the end.</DialogDescription>
        </DialogHeader>

        {done ? (
          <div data-testid="checkout-done" className="flex flex-col items-center gap-3 py-6 text-center">
            <CircleCheck className="size-12 text-emerald-600" />
            <div className="text-lg font-semibold">Receipt {done.number} created</div>
            <div className="text-sm text-muted-foreground">
              {done.items_total} items · amount to pay <b className="text-foreground">{money(done.total)} RWF</b>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="lg" onClick={() => downloadReceipt(done)}>
                <Download />
                Download receipt
              </Button>
              <Button size="lg" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Sale or repair */}
            <section className="flex flex-col gap-2">
              <Label id="purpose-label">1. Checking out for</Label>
              <div role="radiogroup" aria-labelledby="purpose-label" className="grid grid-cols-2 gap-2">
                {(["sale", "repair"] as Purpose[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={purpose === p}
                    onClick={() => {
                      setPurpose(p);
                      if (p === "sale") focusScan();
                    }}
                    className={cn("flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors", purpose === p ? "border-primary bg-secondary ring-2 ring-primary/30" : "hover:bg-muted")}
                  >
                    {p === "sale" ? <ShoppingCart className="size-5 text-primary" /> : <Wrench className="size-5 text-primary" />}
                    <span>
                      <span className="block font-medium">{p === "sale" ? "Sale" : "Repair"}</span>
                      <span className="block text-xs text-muted-foreground">{p === "sale" ? "Customer buys the items" : "Items used for a repair service"}</span>
                    </span>
                  </button>
                ))}
              </div>
              {purpose === "repair" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="service">Service</Label>
                  {services.length ? (
                    <NativeSelect id="service" value={serviceId} onChange={(e) => {
                        setServiceId(e.target.value);
                        focusScan();
                      }} className="w-full [&_select]:h-10">
                      <NativeSelectOption value="">Choose the service…</NativeSelectOption>
                      {services.map((s) => (
                        <NativeSelectOption key={s.id} value={s.id}>
                          {s.name} — {money(s.price)} RWF
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : (
                    <p className="text-sm text-destructive">No services yet. Add them on the “Services &amp; Prices” page first.</p>
                  )}
                </div>
              )}
            </section>

            {/* 2. Scan */}
            <section className="flex flex-col gap-3 rounded-xl border-2 border-dashed p-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">2. Scan each piece or box</div>
                  <div data-testid="out-count" className="text-3xl font-semibold tracking-tight tabular-nums">
                    {itemsTotal} {itemsTotal === 1 ? "item" : "items"}
                  </div>
                </div>
              </div>
              <ScanInput
                ref={scanRef}
                disabled={!canScan}
                onCode={addCode}
                onCamera={() => setCamera(true)}
                onPendingChange={setPending}
                placeholder={canScan ? "Scan with the USB scanner, or type a code and press Enter / Add" : "Choose the service first"}
              />
              {feedback && (
                <div role="status" className={cn("flex items-center gap-2 text-sm font-medium", feedback.kind === "ok" ? "text-emerald-700" : "text-destructive")}>
                  {feedback.kind === "ok" ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />}
                  {feedback.text}
                </div>
              )}
              {pendingBox && (
                <div data-testid="box-choice" className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-secondary p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Boxes className="size-5 text-primary" />
                    <span>
                      <b>Box {pendingBox.code}</b> · {pendingBox.product_name} · <b>{pendingBox.items_left} items left</b>
                      {pendingBox.opened ? " (opened)" : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={() => takeBox("box")}>
                      Whole box ({pendingBox.items_left} items)
                    </Button>
                    <span className="text-muted-foreground">or</span>
                    <Label htmlFor="box-items" className="font-normal">
                      Items from box
                    </Label>
                    <Input
                      id="box-items"
                      type="number"
                      min={1}
                      max={pendingBox.items_left}
                      value={boxItems}
                      onChange={(e) => setBoxItems(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        takeBox("items");
                      }}
                      className="h-9 w-24 bg-card"
                    />
                    <Button type="button" variant="outline" onClick={() => takeBox("items")}>
                      Take items
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        seen.current.delete(pendingBox.code.toLowerCase());
                        setPendingBox(null);
                        focusScan();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {availability.length > 0 && (
              <section data-testid="out-available" className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Available stock</div>
                {availability.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {a.name} <span className="font-normal text-muted-foreground">({a.unit === "box" ? "boxes" : "pieces"})</span>
                    </span>
                    <span className="tabular-nums">
                      available {a.unit === "box" ? `${a.now} items (${a.boxesNow} boxes)` : `${a.now} pcs`} →{" "}
                      <b className={a.after <= 0 ? "text-destructive" : "text-emerald-700"}>
                        {a.unit === "box" ? `${a.after} items (${a.boxesAfter} boxes)` : `${a.after} pcs`}
                      </b>{" "}
                      after this checkout
                    </span>
                  </div>
                ))}
              </section>
            )}

            {/* 3. Receipt lines, with the device serial number for each */}
            {lines.length > 0 && (
              <section className="flex flex-col gap-2">
                <Label>3. Receipt — add the device serial number where needed</Label>
                <div className="overflow-x-auto rounded-lg border">
                  <table data-testid="out-lines" className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-left">Serial number</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Price / item</th>
                        <th className="p-2 text-right">Amount</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.code} className="border-t">
                          <td className="p-2">
                            <div className="font-medium">{lineName(l)}</div>
                            <div className="font-mono text-xs text-muted-foreground">{l.code}</div>
                          </td>
                          <td className="p-2">
                            <Input
                              aria-label={`Serial number for ${l.code}`}
                              value={l.device_serial}
                              onChange={(e) => setLines((list) => list.map((x) => (x.code === l.code ? { ...x, device_serial: e.target.value } : x)))}
                              placeholder="optional"
                              className="h-8 min-w-32 font-mono"
                            />
                          </td>
                          <td className="p-2 text-right tabular-nums">{l.quantity}</td>
                          <td className="p-2 text-right tabular-nums">{money(l.price_per_item)}</td>
                          <td className="p-2 text-right font-medium tabular-nums">{money(l.quantity * l.price_per_item)}</td>
                          <td className="p-2">
                            <button type="button" aria-label={`Remove ${l.code}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => removeLine(l.code)}>
                              <X className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {purpose === "repair" && service && (
                        <tr className="border-t">
                          <td className="p-2">
                            <span className="font-medium">Service:</span> {service.name}
                          </td>
                          <td className="p-2 text-muted-foreground">—</td>
                          <td className="p-2 text-right">1</td>
                          <td className="p-2 text-right tabular-nums">{money(service.price)}</td>
                          <td className="p-2 text-right font-medium tabular-nums">{money(service.price)}</td>
                          <td />
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="border-t bg-secondary/60 font-semibold">
                      <tr>
                        <td className="p-2">Total items</td>
                        <td />
                        <td data-testid="out-items" className="p-2 text-right tabular-nums">
                          {itemsTotal}
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">Amount to pay</td>
                        <td data-testid="out-total" className="p-2 text-right whitespace-nowrap tabular-nums">
                          {money(amountToPay)} RWF
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cust-name">Customer name (optional)</Label>
                    <Input id="cust-name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="h-10" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cust-phone">Phone (optional)</Label>
                    <Input id="cust-phone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="h-10" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pay">Payment</Label>
                    <NativeSelect id="pay" value={customer.payment} onChange={(e) => setCustomer({ ...customer, payment: e.target.value })} className="w-full [&_select]:h-10">
                      {paymentMethods.map((m) => (
                        <NativeSelectOption key={m}>{m}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
              </section>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="lg"
                className="bg-amber-600 hover:bg-amber-600/90"
                disabled={(!lines.length && !pending) || !!pendingBox || saving || (purpose === "repair" && !service)}
                onClick={() => (pending ? scanRef.current?.commit() : finish())}
              >
                {saving ? <LoaderCircle className="animate-spin" /> : pending ? <Plus /> : <Receipt />}
                {pending ? "Add typed code" : <>Check Out &amp; Create Receipt{lines.length ? ` (${money(amountToPay)} RWF)` : ""}</>}
              </Button>
            </DialogFooter>
          </>
        )}

        <BarcodeScanner open={camera} onOpenChange={setCamera} continuous feedback={feedback} onDetected={addCode} onClosed={() => scanRef.current?.focus()} />
      </DialogContent>
    </Dialog>
  );
}
