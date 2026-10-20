"use client";

import { Check, ShoppingBag } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Type a product name and pick it from the Products list. */
export function ProductPicker({ products, onPick, isManager }: { products: Product[]; onPick: (p: Product) => void; isManager: boolean }) {
  return (
    <Command className="rounded-lg border" label="Product">
      <CommandInput placeholder="Type the product name…" autoFocus aria-label="Product" />
      <CommandList className="max-h-56">
        <CommandEmpty>
          {products.length === 0
            ? isManager
              ? "No products yet. Add them on the Products page first."
              : "No products yet. Ask the General Manager to add them on the Products page."
            : "No product with that name."}
        </CommandEmpty>
        <CommandGroup>
          {products.map((p) => (
            <CommandItem key={p.id} value={`${p.name} ${p.product_type}`} onSelect={() => onPick(p)}>
              <ShoppingBag />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.product_type} · buy {money(p.purchase_price)} · sell {money(p.selling_price)} RWF
                </div>
              </div>
              <Check className="opacity-0" />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
