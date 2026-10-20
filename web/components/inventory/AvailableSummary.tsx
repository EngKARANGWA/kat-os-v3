"use client";

import { Boxes, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InventoryItem, Product } from "@/lib/types";

export type Availability = { productId: number; name: string; pieces: number; boxes: number; boxItems: number; total: number; low: boolean };

/** Available stock per product: pieces + boxes (and the items inside them). */
export function availabilityByProduct(items: InventoryItem[], products: Product[]): Availability[] {
  const map = new Map<number, Availability>();
  for (const i of items) {
    if (!i.product_id) continue;
    const a = map.get(i.product_id) ?? {
      productId: i.product_id,
      name: products.find((p) => p.id === i.product_id)?.name ?? i.name.replace(/ \(box\)$/, ""),
      pieces: 0,
      boxes: 0,
      boxItems: 0,
      total: 0,
      low: false,
    };
    if (i.unit === "box") {
      a.boxes += i.quantity;
      a.boxItems += i.available_items ?? i.quantity * (i.items_per_box ?? 1);
    } else a.pieces += i.quantity;
    a.low ||= i.quantity <= i.reorder_level;
    a.total = a.pieces + a.boxItems;
    map.set(i.product_id, a);
  }
  return Array.from(map.values()).sort((x, y) => x.name.localeCompare(y.name));
}

/** "Available by product" cards at the top of the Inventory page. */
export function AvailableSummary({ items, products }: { items: InventoryItem[]; products: Product[] }) {
  const rows = availabilityByProduct(items, products);
  if (!rows.length) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Available by product</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((a) => (
          <Card key={a.productId} data-available={a.name} className={cn("gap-1 px-4", a.total === 0 && "ring-destructive/40")}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{a.name}</span>
              {a.total === 0 ? (
                <span className="rounded-full bg-rose-100 px-2 text-xs text-rose-800">Out of stock</span>
              ) : (
                a.low && <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">Low</span>
              )}
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              <span data-available-total>{a.total.toLocaleString("en-US")}</span> <span className="text-base font-normal text-muted-foreground">items available</span>
            </div>
            <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Package className="size-3.5" /> {a.pieces} pcs
              </span>
              {(a.boxes > 0 || a.boxItems > 0) && (
                <span className="inline-flex items-center gap-1">
                  <Boxes className="size-3.5" /> {a.boxes} {a.boxes === 1 ? "box" : "boxes"} ({a.boxItems} items)
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
