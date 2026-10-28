"use client";

import { useRef, useState } from "react";
import { CircleCheck, LoaderCircle, ScanBarcode, Smartphone } from "lucide-react";
import { Alert, Button, LinkButton, PageHeader, Panel } from "@/components/kat";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useScannerAnywhere, useScannerBurst } from "@/lib/scanner";
import type { Device } from "@/lib/types";

export default function DeviceScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; device: Device | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function find(raw: string) {
    const q = raw.trim();
    if (!q) return setResult(null);
    setCode(q);
    setBusy(true);
    try {
      const { device } = await api<{ device: Device | null }>(`/devices/scan?q=${encodeURIComponent(q)}`);
      setResult({ code: q, device });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
      // Ready for the next scan: the cursor stays here and the code is selected, so the next scan replaces it.
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }

  const burst = useScannerBurst(find); // scanners set up without Enter
  useScannerAnywhere(find); // scanned while the box did not have the cursor

  return (
    <>
      <PageHeader title="Scan / Find Device" description="Scan the IMEI / serial barcode with the barcode scanner (or type it). Existing devices open their owner." />
      <form
        className="mb-6 flex max-w-2xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          burst.cancel();
          find(code);
        }}
      >
        <div className="relative flex-1">
          <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus
            aria-label="IMEI / serial"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              burst.onInput(e.target.value);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete="off"
            placeholder="Scan or type IMEI / serial"
            className="h-12 bg-card pr-32 pl-10 font-mono text-base"
          />
          <span
            className={
              focused
                ? "pointer-events-none absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                : "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground"
            }
          >
            {focused ? (
              <>
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Scanner ready
              </>
            ) : (
              "Scan any time"
            )}
          </span>
        </div>
        <Button type="submit" variant="outline" className="h-12" disabled={busy}>
          {busy && <LoaderCircle className="animate-spin" />}
          Find
        </Button>
      </form>
      {error && <Alert>{error}</Alert>}
      {result?.device && (
        <Panel
          className="max-w-2xl"
          title={
            <span className="flex items-center gap-2">
              <CircleCheck className="size-5 text-emerald-600" />
              Existing Device
            </span>
          }
        >
          <p className="mb-4 text-sm">
            {result.device.category} · {result.device.model} · <span className="font-mono">{result.device.serial_imei}</span>
          </p>
          <LinkButton href={`/clients/${result.device.client_id}`}>Open Client</LinkButton>
        </Panel>
      )}
      {result && !result.device && (
        <Panel
          className="max-w-2xl"
          title={
            <span className="flex items-center gap-2">
              <Smartphone className="size-5 text-primary" />
              NEW DEVICE
            </span>
          }
        >
          <p className="mb-4 text-sm text-muted-foreground">
            No device with <span className="font-mono">{result.code}</span> yet. Register it under the correct client.
          </p>
          <LinkButton href="/clients">Find / Register Client</LinkButton>
        </Panel>
      )}
    </>
  );
}
