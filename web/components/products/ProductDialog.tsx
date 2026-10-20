"use client";

import { useState } from "react";
import { Save, ShoppingBag } from "lucide-react";
import { ApiForm, Field, SelectField, SubmitButton } from "@/components/kat";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Leave out to add a new product; pass a product to edit it. */
  product?: Product | null;
  types: string[];
  onSaved: () => Promise<void>;
};

/** Profit per item and margin, shown while the prices are typed. */
export function profitOf(purchase: number, selling: number) {
  const profit = selling - purchase;
  return { profit, margin: selling > 0 ? Math.round((profit / selling) * 100) : null };
}

/** Add or edit a product: name, type (Finished / Semi-finished / Raw material), purchase price and selling price. */
export function ProductDialog({ open, onOpenChange, product, types, onSaved }: Props) {
  const editing = !!product;
  const [purchase, setPurchase] = useState("");
  const [selling, setSelling] = useState("");

  // Fill the price boxes each time the window opens (empty for a new product).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPurchase(product ? String(product.purchase_price) : "");
      setSelling(product ? String(product.selling_price) : "");
    }
  }
  const bothEntered = purchase !== "" && selling !== "";
  const { profit, margin } = profitOf(Number(purchase), Number(selling));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            {editing ? "Edit Product" : "Add Product"}
          </DialogTitle>
          <DialogDescription>{editing ? `Change the details of “${product.name}”.` : "A product the shop is going to sell."}</DialogDescription>
        </DialogHeader>
        <ApiForm
          key={product?.id ?? "new"}
          layout="grid"
          action={(v) => (editing ? api(`/products/${product.id}`, { method: "PATCH", body: v }) : api("/products", { body: v }))}
          success={editing ? "Product updated." : "Product added."}
          onSuccess={async () => {
            onOpenChange(false);
            await onSaved();
          }}
        >
          <Field full label="Product name" name="name" required autoFocus defaultValue={product?.name} placeholder="e.g. iPhone 13 Screen (OLED)" />
          <SelectField
            full
            label="Type"
            name="product_type"
            defaultValue={product?.product_type ?? "Finished"}
            options={types}
            hint="Finished = ready to sell · Semi-finished = partly made · Raw material = used to make other products"
          />
          <Field label="Purchase price (RWF)" type="number" name="purchase_price" min={0} step={1} required value={purchase} onChange={(e) => setPurchase(e.target.value)} placeholder="What the shop pays" />
          <Field label="Selling price (RWF)" type="number" name="selling_price" min={0} step={1} required value={selling} onChange={(e) => setSelling(e.target.value)} placeholder="What the customer pays" />
          {bothEntered && (
            <div
              data-testid="profit-preview"
              className={cn("rounded-lg p-3 text-sm sm:col-span-2", profit < 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-800")}
            >
              {profit < 0 ? "Loss" : "Profit"} per item: <b>{money(Math.abs(profit))} RWF</b>
              {margin !== null && <> · margin {margin < 0 ? `−${-margin}` : margin}%</>}
              {profit < 0 && " — the selling price is lower than the purchase price."}
            </div>
          )}
          <SubmitButton full icon={<Save />} className="w-full">
            {editing ? "Save Changes" : "Add Product"}
          </SubmitButton>
        </ApiForm>
      </DialogContent>
    </Dialog>
  );
}
