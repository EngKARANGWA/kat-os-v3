"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowDownToLine, Boxes, CircleAlert, CircleCheck, LoaderCircle, Package, X } from "lucide-react";
import { BarcodeScanner } from "@/components/kat";
import { useFlash } from "@/components/Flash";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { beep } from "@/lib/beep";
import { fmtDateTime, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InventoryItem, Product } from "@/lib/types";
import { ProductPicker } from "./ProductPicker";
import { ScanInput, type ScanInputHandle } from "./ScanInput";

type Unit = "piece" | "box";
type Scanned = { code: string; checking: boolean };
type Feedback = { kind: "ok" | "error"; text: string } | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  items: InventoryItem[];
  isManager: boolean;
  /** Start with this product / unit (from a stock row's "In" button). */
  initial?: { productId: number; unit: Unit } | null;
  onSaved: () => Promise<void>;
};

const plural = (n: number, unit: Unit) => `${n} ${unit === "box" ? (n === 1 ? "box" : "boxes") : n === 1 ? "piece" : "pieces"}`;

/**
 * Check In by scanning: pick the product, choose pieces or boxes, enter the supplier,
 * then scan every piece (or every box) one by one. "Add to Inventory" adds the number scanned to current stock.
 */
export function CheckInDialog({ open, onOpenChange, products, items, isManager, initial, onSaved }: Props) {
  const flash = useFlash();
  const [product, setProduct] = useState<Product | null>(null);
  const [unit, setUnit] = useState<Unit>("piece");
  const [perBox, setPerBox] = useState("");
  const [supplier, setSupplier] = useState("");
  const [scanned, setScanned] = useState<Scanned[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [camera, setCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false); // something typed in the scan box but not added yet
  const scanRef = useRef<ScanInputHandle>(null);
  // Accepted codes in this session (lower-case → as scanned), updated at once so back-to-back scans see each other.
  const seen = useRef(new Map<string, string>());

  // Fresh form every time the window opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const p = initial ? (products.find((x) => x.id === initial.productId) ?? null) : null;
      const line = p && items.find((i) => i.product_id === p.id && i.unit === initial!.unit);
      setProduct(p);
      setUnit(initial?.unit ?? "piece");
      setPerBox(line?.items_per_box ? String(line.items_per_box) : "");
      setSupplier(line?.supplier ?? "");
      setScanned([]);
      seen.current = new Map();
      setPending(false);
      setFeedback(null);
    }
  }

  const stockLine = product ? items.find((i) => i.product_id === product.id && i.unit === unit) : undefined;
  const current = stockLine?.quantity ?? 0;
  const perBoxNum = Number(perBox);
  const ready = !!product && supplier.trim() !== "" && (unit === "piece" || perBoxNum >= 1);
  const count = scanned.length;
  // Enter in Supplier / Items per box → straight to the scan box.
  const toScan = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    scanRef.current?.focus(); // at once, so a fast scanner's first characters land in the scan box
  };
  const suppliers = Array.from(new Set(items.map((i) => i.supplier).filter(Boolean))) as string[];

  const addCode = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const key = code.toLowerCase();
      if (seen.current.has(key)) {
        beep("error");
        setFeedback({ kind: "error", text: `Already scanned: ${code} — not counted again.` });
        return;
      }
      seen.current.set(key, code);
      // Always build on the latest list: other scans may have finished checking in the meantime.
      setScanned((list) => [{ code, checking: true }, ...list]);
      setFeedback({ kind: "ok", text: `Scanned: ${code}` });
      try {
        // Was this code checked in on an earlier day?
        const { found } = await api<{ found: { code: string; item_name: string; checked_in_at: string }[] }>("/inventory/codes/lookup", { body: { codes: [code] } });
        if (found.length) {
          beep("error");
          seen.current.delete(key);
          setScanned((list) => list.filter((s) => s.code !== code));
          setFeedback({ kind: "error", text: `${code} was already checked in on ${fmtDateTime(found[0].checked_in_at)} (${found[0].item_name}) — not counted.` });
          return;
        }
        beep("ok");
        setScanned((list) => list.map((s) => (s.code === code ? { ...s, checking: false } : s)));
      } catch {
        setScanned((list) => list.map((s) => (s.code === code ? { ...s, checking: false } : s))); // the server checks again on save
      }
    },
    [],
  );

  function close(next: boolean) {
    if (!next && scanned.length && !saving && !window.confirm(`Discard the ${plural(scanned.length, unit)} you scanned? They have not been added to inventory.`)) return;
    onOpenChange(next);
  }

  async function addToInventory() {
    if (!product) return;
    await scanRef.current?.commit(); // a code typed but not added yet is added first
    const codes = Array.from(seen.current.values()).reverse(); // in scan order
    if (!codes.length) return;
    setSaving(true);
    try {
      const r = await api<{ added: number; after: number }>("/inventory/checkin-scan", {
        body: { product_id: product.id, unit, items_per_box: unit === "box" ? perBox : undefined, supplier, codes },
      });
      flash(`Added ${plural(r.added, unit)} of ${product.name} — now ${plural(r.after, unit)} in stock.`);
      setScanned([]);
      seen.current = new Map();
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not add to inventory.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="size-5 text-emerald-600" />
            Check In
          </DialogTitle>
          <DialogDescription>Choose the product, then scan every piece or box you received.</DialogDescription>
        </DialogHeader>

        {/* 1. Product */}
        <section className="flex flex-col gap-2">
          <Label>1. Product</Label>
          {product ? (
            <div data-testid="checkin-product" className="flex items-center justify-between gap-3 rounded-lg bg-secondary p-3 text-sm">
              <div>
                <div className="font-medium text-foreground">{product.name}</div>
                <div className="text-secondary-foreground">
                  {product.product_type} · buy {money(product.purchase_price)} · sell {money(product.selling_price)} RWF
                </div>
              </div>
              <Button type="button" variant="outline" disabled={count > 0} onClick={() => setProduct(null)}>
                Change
              </Button>
            </div>
          ) : (
            <ProductPicker products={products} isManager={isManager} onPick={setProduct} />
          )}
        </section>

        {product && (
          <>
            {/* 2. Pieces or boxes */}
            <section className="flex flex-col gap-2">
              <Label id="unit-label">2. Counting</Label>
              <div role="radiogroup" aria-labelledby="unit-label" className="grid grid-cols-2 gap-2">
                {(["piece", "box"] as Unit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={unit === u}
                    disabled={count > 0}
                    onClick={() => setUnit(u)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-60",
                      unit === u ? "border-primary bg-secondary ring-2 ring-primary/30" : "hover:bg-muted",
                    )}
                  >
                    {u === "piece" ? <Package className="size-5 text-primary" /> : <Boxes className="size-5 text-primary" />}
                    <span>
                      <span className="block font-medium">{u === "piece" ? "Pieces" : "Boxes"}</span>
                      <span className="block text-xs text-muted-foreground">{u === "piece" ? "Scan every single item" : "Scan every box"}</span>
                    </span>
                  </button>
                ))}
              </div>
              {unit === "box" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="per-box">Items per box</Label>
                  <Input id="per-box" type="number" min={1} value={perBox} disabled={count > 0} onChange={(e) => setPerBox(e.target.value)} onKeyDown={toScan} placeholder="e.g. 20" className="h-10 w-40" />
                </div>
              )}
            </section>

            {/* 3. Supplier */}
            <section className="flex flex-col gap-2">
              <Label htmlFor="supplier">3. Supplier</Label>
              <Input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} onKeyDown={toScan} autoFocus={!supplier} placeholder="Who delivered it?" className="h-10" autoComplete="off" />
              {suppliers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  Recent:
                  {suppliers.slice(0, 6).map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={cn("rounded-full border px-2 py-0.5 hover:border-primary hover:text-primary", supplier === name && "border-primary bg-secondary text-primary")}
                      onClick={() => {
                        setSupplier(name);
                        setTimeout(() => scanRef.current?.focus(), 0);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Scan */}
            <section className="flex flex-col gap-3 rounded-xl border-2 border-dashed p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">4. Scan {unit === "box" ? "each box" : "each piece"}</div>
                  <div data-testid="scan-count" className="text-3xl font-semibold tracking-tight tabular-nums">
                    {plural(count, unit)} scanned
                  </div>
                  {unit === "box" && perBoxNum >= 1 && (
                    <div className="text-sm text-muted-foreground">= {(count * perBoxNum).toLocaleString("en-US")} items</div>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  In stock now: <b className="text-foreground">{plural(current, unit)}</b>
                  <br />
                  After check-in: <b data-testid="stock-after" className="text-emerald-700">{plural(current + count, unit)}</b>
                </div>
              </div>

              <ScanInput
                ref={scanRef}
                disabled={!ready}
                onCode={addCode}
                onCamera={() => setCamera(true)}
                onPendingChange={setPending}
                placeholder={ready ? "Scan with the USB scanner, or type a code and press Enter / Add" : unit === "box" && perBoxNum < 1 ? "Enter items per box first" : "Enter the supplier first"}
              />

              {feedback && (
                <div role="status" className={cn("flex items-center gap-2 text-sm font-medium", feedback.kind === "ok" ? "text-emerald-700" : "text-destructive")}>
                  {feedback.kind === "ok" ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />}
                  {feedback.text}
                </div>
              )}

              {count > 0 && (
                <ul data-testid="scanned-list" className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {scanned.map((s) => (
                    <li key={s.code} className="inline-flex items-center gap-1 rounded-md border bg-card py-0.5 pr-1 pl-2 font-mono text-xs">
                      {s.checking && <LoaderCircle className="size-3 animate-spin text-muted-foreground" />}
                      {s.code}
                      <button
                        type="button"
                        aria-label={`Remove ${s.code}`}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => {
                          seen.current.delete(s.code.toLowerCase()); // may be scanned again
                          setScanned((list) => list.filter((x) => x.code !== s.code));
                        }}
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" size="lg" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="button" size="lg" className="bg-emerald-600 hover:bg-emerald-600/90" disabled={!ready || (count === 0 && !pending) || saving || scanned.some((s) => s.checking)} onClick={addToInventory}>
            {saving ? <LoaderCircle className="animate-spin" /> : <ArrowDownToLine />}
            Add to Inventory{count > 0 ? ` (${plural(count, unit)})` : ""}
          </Button>
        </DialogFooter>

        <BarcodeScanner
          open={camera}
          onOpenChange={setCamera}
          continuous
          feedback={feedback}
          onDetected={addCode}
          onClosed={() => scanRef.current?.focus()}
        />
      </DialogContent>
    </Dialog>
  );
}
