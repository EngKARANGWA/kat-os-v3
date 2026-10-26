"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Plus } from "lucide-react";
import { Async, DataTable, PageHeader, Panel, useFilters } from "@/components/kat";
import { AddStockDialog } from "@/components/inventory/AddStockDialog";
import { AvailableSummary } from "@/components/inventory/AvailableSummary";
import { CheckInDialog } from "@/components/inventory/CheckInDialog";
import { CheckOutDialog } from "@/components/inventory/CheckOutDialog";
import { ReceiptsTable } from "@/components/inventory/ReceiptsTable";
import { MovementsTable } from "@/components/inventory/MovementsTable";
import { StockMoveDialog } from "@/components/inventory/StockMoveDialog";
import { useMe } from "@/components/Session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/lib/api";
import { can } from "@/lib/permissions";
import { DEVICE_CATEGORIES, PART_CATEGORIES } from "@/lib/constants";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Branch, InventoryItem, Product, Sale, StockMovement } from "@/lib/types";

type Movements = { movements: StockMovement[]; check_in_reasons: string[]; check_out_reasons: string[] };
// scan = product Check In by scanning; in = quick check-in by SKU (stock items not linked to a product)
// scan / scanOut = by scanning product codes; in / out = quick by SKU (stock items not linked to a product)
type Open = { kind: "scan"; productId?: number; unit?: "piece" | "box" } | { kind: "scanOut" } | { kind: "in" | "out" | "add"; sku?: string } | null;

/** "5 pieces", "3 boxes · 20/box" */
const qtyText = (i: InventoryItem) =>
  i.unit === "box"
    ? `${i.quantity} ${i.quantity === 1 ? "box" : "boxes"}${i.items_per_box ? ` · ${i.items_per_box}/box` : ""}${i.opened_boxes ? ` · ${i.opened_boxes.count} opened (${i.opened_boxes.items_left} left)` : ""}`
    : `${i.quantity} ${i.quantity === 1 ? "piece" : "pcs"}`;

const isLow = (i: InventoryItem) => i.quantity <= i.reorder_level;

export default function InventoryPage() {
  const { data, error, reload } = useApi<{ items: InventoryItem[] }>("/inventory");
  const { data: moves, reload: reloadMoves } = useApi<Movements>("/inventory/movements");
  const { data: branches } = useApi<{ branches: Branch[] }>("/branches");
  const { data: catalogue } = useApi<{ products: Product[] }>("/products");
  const { data: services } = useApi<{ services: { id: number; name: string; price: number }[] }>("/services");
  const { data: meta } = useApi<{ payment_methods: string[] }>("/meta");
  const { data: receipts, reload: reloadReceipts } = useApi<{ sales: Sale[] }>("/sales");
  const me = useMe();
  const [open, setOpen] = useState<Open>(null);
  const items = data?.items ?? [];
  const refresh = async () => {
    await Promise.all([reload(), reloadMoves(), reloadReceipts()]);
  };

  const { rows, bar, filtering } = useFilters(
    items,
    {
      placeholder: "Find: scan or type SKU, name, model, supplier…",
      search: (i) => [i.sku, i.name, i.category, i.device_category, i.compatible_models, i.supplier],
      filters: [
        { kind: "select", key: "device", label: "Devices", value: (i) => i.device_category, options: DEVICE_CATEGORIES },
        { kind: "select", key: "type", label: "Part types", value: (i) => i.category, options: PART_CATEGORIES },
        { kind: "select", key: "supplier", label: "Suppliers", value: (i) => i.supplier },
        { kind: "select", key: "branch", label: "Branches", value: (i) => i.branch },
        { kind: "toggle", key: "low", label: "Low stock", test: isLow },
        { kind: "toggle", key: "out", label: "Out of stock", test: (i) => i.quantity === 0 },
      ],
    },
    "inventory",
  );
  const stockValue = rows.reduce((sum, i) => sum + i.quantity * i.cost_price, 0);
  const close = (o: boolean) => !o && setOpen(null);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Check stock in and out by scanning. Items at or below the reorder level are flagged."
        action={
          data && (
            <div className="flex flex-wrap gap-2">
              <Button size="lg" variant="outline" className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" onClick={() => setOpen({ kind: "scan" })}>
                <ArrowDownToLine />
                Check In
              </Button>
              <Button size="lg" onClick={() => setOpen({ kind: "add" })}>
                <Plus />
                Add Stock
              </Button>
              <Button size="lg" variant="outline" className="border-amber-600/40 text-amber-700 hover:bg-amber-50 hover:text-amber-800" onClick={() => setOpen({ kind: "scanOut" })}>
                <ArrowUpFromLine />
                Check Out
              </Button>
            </div>
          )
        }
      />

      {data && <AvailableSummary items={items} products={catalogue?.products ?? []} />}

      <Tabs defaultValue="stock">
        <TabsList className="mb-4">
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="movements">Movements{moves ? ` (${moves.movements.length})` : ""}</TabsTrigger>
          <TabsTrigger value="receipts">Receipts{receipts ? ` (${receipts.sales.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Panel
            title="Stock"
            action={
              data && (
                <span className="text-sm text-muted-foreground">
                  Stock value (cost): <b className="text-foreground">{money(stockValue)} RWF</b>
                </span>
              )
            }
          >
            <Async data={data} error={error}>
              {() => (
                <>
                  {bar}
                  <DataTable
                    rows={rows}
                    rowKey={(i) => i.id}
                    empty={filtering ? "No stock item matches these filters." : "No stock items yet. Click “Add Stock” to add the first one."}
                    columns={[
                      { header: "SKU", cell: (i) => <span className="font-mono text-xs">{i.sku}</span> },
                      {
                        header: "Item",
                        cell: (i) => (
                          <div>
                            <div className="font-medium">{i.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {i.device_category} · {i.category}
                              {i.supplier ? ` · ${i.supplier}` : ""}
                            </div>
                          </div>
                        ),
                      },
                      { header: "Checked in", cell: (i) => <span className="text-emerald-700 tabular-nums">{i.checked_in ?? "—"}</span> },
                      { header: "Checked out", cell: (i) => <span className="text-amber-700 tabular-nums">{i.checked_out ?? "—"}</span> },
                      {
                        header: "Available",
                        cell: (i) => (
                          <div>
                            <span className="inline-flex items-center gap-2">
                              <span className={cn("text-base font-semibold tabular-nums", i.quantity === 0 ? "text-destructive" : "text-foreground")}>{i.quantity}</span>
                              {i.quantity === 0 ? (
                                <Badge className="bg-rose-100 text-rose-800">Out</Badge>
                              ) : (
                                isLow(i) && <Badge className="bg-amber-100 text-amber-800">Low</Badge>
                              )}
                            </span>
                            <div data-qty={i.quantity} className="max-w-52 text-xs whitespace-normal text-muted-foreground">
                              {qtyText(i)}
                              {i.unit === "box" && i.available_items != null && ` · ${i.available_items} items`}
                              {` · reorder at ${i.reorder_level}`}
                            </div>
                          </div>
                        ),
                      },
                      {
                        header: "Cost / Sell",
                        cell: (i) => (
                          <span className="whitespace-nowrap tabular-nums">
                            {money(i.cost_price)} <span className="text-muted-foreground">/</span> {money(i.selling_price)}
                          </span>
                        ),
                      },
                      {
                        header: "",
                        cell: (i) => (
                          <div className="flex justify-end gap-1.5">
                            <Button variant="outline" aria-label={`Check in ${i.name}`} onClick={() => setOpen(i.product_id ? { kind: "scan", productId: i.product_id, unit: i.unit } : { kind: "in", sku: i.sku })}>
                              <ArrowDownToLine className="text-emerald-700" />
                              In
                            </Button>
                            <Button variant="outline" aria-label={`Check out ${i.name}`} disabled={i.quantity === 0} onClick={() => setOpen(i.product_id ? { kind: "scanOut" } : { kind: "out", sku: i.sku })}>
                              <ArrowUpFromLine className="text-amber-700" />
                              Out
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </>
              )}
            </Async>
          </Panel>
        </TabsContent>

        <TabsContent value="movements">
          <Panel title="Stock Movements" description="Every check-in, check-out, adjustment and part used on a repair.">
            <Async data={moves} error={null}>
              {(m) => <MovementsTable movements={m.movements} />}
            </Async>
          </Panel>
        </TabsContent>

        <TabsContent value="receipts">
          <Panel title="Receipts" description="Made by Check Out — sales, and items used for repairs with their service.">
            <Async data={receipts} error={null}>
              {(r) => <ReceiptsTable sales={r.sales} />}
            </Async>
          </Panel>
        </TabsContent>
      </Tabs>

      {moves && (
        <>
          <StockMoveDialog
            mode="in"
            open={open?.kind === "in"}
            onOpenChange={close}
            initialSku={open?.kind === "in" ? open.sku : undefined}
            items={items}
            reasons={moves.check_in_reasons}
            onSaved={refresh}
            onAddNew={(sku) => setOpen({ kind: "add", sku })}
          />
          <StockMoveDialog
            mode="out"
            open={open?.kind === "out"}
            onOpenChange={close}
            initialSku={open?.kind === "out" ? open.sku : undefined}
            items={items}
            reasons={moves.check_out_reasons}
            onSaved={refresh}
          />
        </>
      )}
      <CheckInDialog
        open={open?.kind === "scan"}
        onOpenChange={close}
        initial={open?.kind === "scan" && open.productId ? { productId: open.productId, unit: open.unit ?? "piece" } : null}
        products={catalogue?.products ?? []}
        items={items}
        isManager={can(me, "products")}
        onSaved={refresh}
      />
      <CheckOutDialog
        open={open?.kind === "scanOut"}
        onOpenChange={close}
        services={services?.services ?? []}
        paymentMethods={meta?.payment_methods ?? ["Cash"]}
        items={items}
        onSaved={refresh}
      />
      <AddStockDialog
        open={open?.kind === "add"}
        onOpenChange={close}
        initialSku={open?.kind === "add" ? open.sku : undefined}
        items={items}
        branches={branches?.branches ?? []}
        onSaved={refresh}
      />
    </>
  );
}
