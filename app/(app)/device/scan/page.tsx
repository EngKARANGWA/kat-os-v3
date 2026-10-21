"use client";

import { useState } from "react";
import { CircleCheck, Smartphone } from "lucide-react";
import { Alert, LinkButton, PageHeader, Panel, SearchBox } from "@/components/kat";
import { api } from "@/lib/api";
import type { Device } from "@/lib/types";

export default function DeviceScanPage() {
  const [result, setResult] = useState<{ device: Device | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function find(q: string) {
    if (!q) return setResult(null);
    try {
      setResult(await api<{ device: Device | null }>(`/devices/scan?q=${encodeURIComponent(q)}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    }
  }

  return (
    <>
      <PageHeader title="Scan / Find Device" description="Scan the barcode or type the IMEI / serial number. Existing devices open their owner." />
      <SearchBox autoFocus placeholder="Scan or type IMEI / serial" button="Find" onSearch={find} />
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
          <p className="mb-4 text-sm text-muted-foreground">No existing device found. Register it under the correct client.</p>
          <LinkButton href="/clients">Find / Register Client</LinkButton>
        </Panel>
      )}
    </>
  );
}
