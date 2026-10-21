"use client";

import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useFlash } from "@/components/Flash";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

/** Delete button that asks "Are you sure?" first. */
export function DeleteProductButton({ product, onDeleted }: { product: Product; onDeleted: () => Promise<void> }) {
  const flash = useFlash();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await api(`/products/${product.id}`, { method: "DELETE" });
      await onDeleted();
      flash(`“${product.name}” deleted.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not delete.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${product.name}`} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{product.name}”?</AlertDialogTitle>
          <AlertDialogDescription>This removes the product from the list. It cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={remove}>
            <Trash2 />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
