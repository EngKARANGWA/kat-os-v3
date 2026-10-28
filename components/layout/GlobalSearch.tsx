"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, Package, Search, Smartphone, User, Wrench } from "lucide-react";
import { StatusBadge } from "@/components/kat";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { api } from "@/lib/api";
import { useScannerAnywhere } from "@/lib/scanner";
import type { Client, Device, InventoryItem, RepairSummary } from "@/lib/types";

type Results = { repairs: RepairSummary[]; clients: Client[]; devices: (Device & { client_name: string })[]; items: InventoryItem[] };
const EMPTY: Results = { repairs: [], clients: [], devices: [], items: [] };

/**
 * "Search everything" box in the top bar (Ctrl+K or /). Finds repairs, clients, devices and stock items.
 * Scanning a ticket or IMEI with a USB scanner opens the first match (the scanner presses Enter).
 * A code scanned while no box has the cursor opens this search; one exact match (IMEI, ticket, SKU) opens straight away.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const scanned = useRef<string | null>(null); // code from a scan anywhere on the page, waiting for its results

  const pathname = usePathname();

  // The Scan IMEI page handles its own scans.
  useScannerAnywhere((code) => {
    scanned.current = code;
    setQ(code);
    setOpen(true);
  }, !pathname.startsWith("/device/scan"));

  // Keyboard shortcut: Ctrl+K / Cmd+K anywhere, or "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable=true]");
      if ((e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ask the API 250 ms after the user stops typing.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(EMPTY);
      return;
    }
    setLoading(true);
    let current = true;
    const t = setTimeout(() => {
      api<Results>(`/search?q=${encodeURIComponent(term)}`)
        .then((r) => {
          if (!current) return;
          setResults(r);
          if (scanned.current === term) {
            scanned.current = null;
            const href = exactMatch(r, term);
            if (href) {
              setOpen(false);
              setQ("");
              router.push(href);
            }
          }
        })
        .catch(() => current && setResults(EMPTY))
        .finally(() => current && setLoading(false));
    }, 250);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [q, router]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const total = results.repairs.length + results.clients.length + results.devices.length + results.items.length;

  return (
    <>
      <Button variant="outline" className="h-10 w-full max-w-md justify-start gap-2 bg-muted/40 text-muted-foreground" onClick={() => setOpen(true)} aria-label="Search everything">
        <Search />
        <span className="truncate">Search everything…</span>
        <kbd className="ml-auto hidden rounded border bg-card px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search everything" description="Search repairs, clients, devices and stock" className="sm:max-w-xl">
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder="Ticket, client, phone, IMEI / serial, SKU…" />
          <CommandList className="max-h-[60vh]">
            {q.trim().length < 2 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">Type at least 2 characters, or scan a code.</div>
            ) : loading && total === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Searching…
              </div>
            ) : (
              <CommandEmpty>Nothing found for “{q.trim()}”.</CommandEmpty>
            )}

            {results.repairs.length > 0 && (
              <CommandGroup heading="Repairs">
                {results.repairs.map((r) => (
                  <CommandItem key={`r${r.id}`} value={`repair-${r.id}`} onSelect={() => go(`/repairs/${r.id}`)}>
                    <Wrench />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {r.ticket_code} · {r.device}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.client_name} · {r.client_phone}
                        {r.serial_imei ? ` · ${r.serial_imei}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.clients.length > 0 && (
              <CommandGroup heading="Clients">
                {results.clients.map((c) => (
                  <CommandItem key={`c${c.id}`} value={`client-${c.id}`} onSelect={() => go(`/clients/${c.id}`)}>
                    <User />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{c.full_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.phone}
                        {c.email ? ` · ${c.email}` : ""} · {c.repair_count} repairs
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.devices.length > 0 && (
              <CommandGroup heading="Devices">
                {results.devices.map((d) => (
                  <CommandItem key={`d${d.id}`} value={`device-${d.id}`} onSelect={() => go(`/clients/${d.client_id}`)}>
                    <Smartphone />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {d.model?.toLowerCase().startsWith(d.category.toLowerCase()) ? d.model : `${d.category} ${d.model ?? ""}`}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {d.serial_imei || "No serial"} · owner {d.client_name}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.items.length > 0 && (
              <CommandGroup heading="Stock">
                {results.items.map((i) => (
                  <CommandItem key={`i${i.id}`} value={`item-${i.id}`} onSelect={() => go(`/inventory?find=${encodeURIComponent(i.sku)}`)}>
                    <Package />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{i.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {i.sku} · {i.quantity} in stock
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

/** The page for the one result whose code is exactly the scanned code, if there is exactly one. */
function exactMatch(r: Results, code: string): string | null {
  const same = (v?: string | null) => !!v && v.toLowerCase() === code.toLowerCase();
  const hits = [
    ...r.devices.filter((d) => same(d.serial_imei)).map((d) => `/clients/${d.client_id}`),
    ...r.repairs.filter((x) => same(x.ticket_code)).map((x) => `/repairs/${x.id}`),
    ...r.items.filter((i) => same(i.sku)).map((i) => `/inventory?find=${encodeURIComponent(i.sku)}`),
  ];
  return new Set(hits).size === 1 ? hits[0] : null;
}
