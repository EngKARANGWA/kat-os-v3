"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Async, DataTable, PageHeader, Panel, StatCard, StatGrid, useFilters } from "@/components/kat";
import { DeleteProductButton } from "@/components/products/DeleteProductButton";
import { ProductDialog, profitOf } from "@/components/products/ProductDialog";
import { RequirePermission } from "@/components/Session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api";
import { fmtDate, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

const TYPE_STYLES: Record<string, string> = {
  Finished: "bg-emerald-100 text-emerald-800",
  "Semi-finished": "bg-sky-100 text-sky-800",
  "Raw material": "bg-amber-100 text-amber-800",
};

function Products() {
  const { data, error, reload } = useApi<{ products: Product[]; types: string[] }>("/products");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const types = data?.types ?? [];
  const all = data?.products ?? [];
  const { rows, bar, filtering } = useFilters(
    all,
    {
      placeholder: "Search products…",
      search: (p) => [p.name, p.product_type, p.purchase_price, p.selling_price],
      filters: [
        { kind: "select", key: "type", label: "Types", value: (p) => p.product_type, options: types },
        { kind: "toggle", key: "loss", label: "Selling at a loss", test: (p) => p.selling_price < p.purchase_price },
      ],
    },
    "products",
  );
  const count = (t: string) => all.filter((p) => p.product_type === t).length;

  const startAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const startEdit = (p: Product) => {
    setEditing(p);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Products"
        description="Products the shop sells. Only the General Manager can add, edit or delete them."
        action={
          data && (
            <Button size="lg" onClick={startAdd}>
              <Plus />
              Add Product
            </Button>
          )
        }
      />
      <Async data={data} error={error}>
        {() => (
          <>
            <StatGrid columns={4}>
              <StatCard value={all.length} label="All products" />
              <StatCard value={count("Finished")} label="Finished" />
              <StatCard value={count("Semi-finished")} label="Semi-finished" />
              <StatCard value={count("Raw material")} label="Raw material" />
            </StatGrid>
            <Panel>
              {bar}
              <DataTable
                rows={rows}
                rowKey={(p) => p.id}
                empty={filtering ? "No products match these filters." : "No products yet. Click “Add Product” to add the first one."}
                columns={[
                  { header: "Name", cell: (p) => <span className="font-medium">{p.name}</span> },
                  { header: "Type", cell: (p) => <Badge className={cn("rounded-full", TYPE_STYLES[p.product_type])}>{p.product_type}</Badge> },
                  { header: "Purchase price", cell: (p) => <span className="tabular-nums">{money(p.purchase_price)} RWF</span> },
                  { header: "Selling price", cell: (p) => <span className="font-medium tabular-nums">{money(p.selling_price)} RWF</span> },
                  {
                    header: "Profit / item",
                    cell: (p) => {
                      const { profit, margin } = profitOf(p.purchase_price, p.selling_price);
                      return (
                        <span data-profit className={cn("tabular-nums", profit < 0 ? "font-medium text-destructive" : "text-emerald-700")}>
                          {profit < 0 ? "−" : ""}
                          {money(Math.abs(profit))} RWF{margin !== null && <span className="text-muted-foreground"> · {margin < 0 ? `−${-margin}` : margin}%</span>}
                        </span>
                      );
                    },
                  },
                  { header: "Last changed", cell: (p) => <span className="text-muted-foreground">{fmtDate(p.updated_at)}</span> },
                  {
                    header: "",
                    cell: (p) => (
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" aria-label={`Edit ${p.name}`} onClick={() => startEdit(p)}>
                          <Pencil />
                          Edit
                        </Button>
                        <DeleteProductButton product={p} onDeleted={reload} />
                      </div>
                    ),
                  },
                ]}
              />
            </Panel>
          </>
        )}
      </Async>
      <ProductDialog open={open} onOpenChange={setOpen} product={editing} types={types} onSaved={reload} />
    </>
  );
}

export default function ProductsPage() {
  return (
    <RequirePermission permission="products">
      <Products />
    </RequirePermission>
  );
}
