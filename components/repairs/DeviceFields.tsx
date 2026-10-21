"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, LoaderCircle, Smartphone } from "lucide-react";
import { ScanField, SuggestInput, type Suggestion } from "@/components/kat";
import { api, useApi } from "@/lib/api";
import { COMMON_MODELS } from "@/lib/constants";
import type { Device, RepairSummary } from "@/lib/types";

type Lookup = { state: "idle" | "checking" } | { state: "mine" | "other" | "new"; device?: Device } | { state: "repaired"; repair: RepairSummary };

/**
 * The Device and IMEI / Serial fields of the New Repair form.
 * Device: search the client's devices (registered or repaired before) or common models (or type anything).
 * IMEI / Serial: scan (USB scanner or camera) or type; it is looked up straight away.
 */
export function DeviceFields({ clientId }: { clientId: number }) {
  const { data } = useApi<{ devices: Device[]; repairs: RepairSummary[] }>(`/clients/${clientId}`);
  // Registered devices first, then devices from earlier repairs (once per IMEI / serial, or per name when there is none).
  const devices: { name: string; serial: string | null }[] = [];
  for (const d of [...(data?.devices ?? []).map((d) => ({ name: d.model || d.category, serial: d.serial_imei })), ...(data?.repairs ?? []).map((r) => ({ name: r.device, serial: r.serial_imei }))])
    if (!devices.some((x) => (d.serial ? x.serial?.toLowerCase() === d.serial.toLowerCase() : !x.serial && x.name === d.name))) devices.push(d);
  const [device, setDevice] = useState("");
  const [serial, setSerial] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });

  const suggestions: Suggestion[] = [
    ...devices.map((d) => ({ value: d.name, hint: d.serial || "no IMEI / serial", group: "This client's devices" })),
    ...COMMON_MODELS.map((m) => ({ value: m, group: "Model" })),
  ];

  // Look the IMEI / serial up shortly after it stops changing (a scan, or the last key typed).
  useEffect(() => {
    const code = serial.trim();
    if (code.length < 4) {
      setLookup({ state: "idle" });
      return;
    }
    setLookup({ state: "checking" });
    let current = true;
    const t = setTimeout(async () => {
      try {
        const { device: found } = await api<{ device: Device | null }>(`/devices/scan?q=${encodeURIComponent(code)}`);
        if (!current) return;
        if (!found) {
          const repair = data?.repairs.find((r) => r.serial_imei?.toLowerCase() === code.toLowerCase());
          if (!repair) return setLookup({ state: "new" });
          setLookup({ state: "repaired", repair });
          return setDevice((d) => d || repair.device);
        }
        if (found.client_id === clientId) {
          setLookup({ state: "mine", device: found });
          setDevice((d) => d || found.model || found.category); // fill Device if still empty
        } else setLookup({ state: "other", device: found });
      } catch {
        if (current) setLookup({ state: "idle" });
      }
    }, 400);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [serial, clientId, data]);

  const result =
    lookup.state === "checking" ? (
      <span className="inline-flex items-center gap-1">
        <LoaderCircle className="size-3 animate-spin" /> Looking it up…
      </span>
    ) : lookup.state === "mine" ? (
      <span data-testid="imei-result" className="inline-flex items-center gap-1 font-medium text-emerald-700">
        <CircleCheck className="size-3.5" /> Registered device of this client: {lookup.device?.category} {lookup.device?.model}
      </span>
    ) : lookup.state === "other" ? (
      <span data-testid="imei-result" className="inline-flex items-center gap-1 font-medium text-destructive">
        <CircleAlert className="size-3.5" /> This IMEI / serial is registered to another client —{" "}
        <Link className="underline" href={`/clients/${lookup.device?.client_id}`}>
          open that client
        </Link>
      </span>
    ) : lookup.state === "repaired" ? (
      <span data-testid="imei-result" className="inline-flex items-center gap-1 font-medium text-emerald-700">
        <CircleCheck className="size-3.5" /> Repaired before for this client: {lookup.repair.device} ({lookup.repair.ticket_code})
      </span>
    ) : lookup.state === "new" ? (
      <span data-testid="imei-result" className="inline-flex items-center gap-1">
        <Smartphone className="size-3.5" /> New device — not registered yet.
      </span>
    ) : (
      "Scan the IMEI / serial barcode, or type it."
    );

  return (
    <>
      <SuggestInput
        label="Device"
        name="device"
        value={device}
        onChange={setDevice}
        onPick={(s) => {
          // Picking one of the client's devices also fills its IMEI / serial.
          if (s.group === "This client's devices" && s.hint && s.hint !== "no IMEI / serial") setSerial(s.hint);
        }}
        suggestions={suggestions}
        placeholder="Search: iPhone 15 Pro Max, MacBook Air…"
        required
        autoFocus
        hint={devices.length ? `${devices.length} device${devices.length === 1 ? "" : "s"} known for this client — type to search.` : undefined}
      />
      <ScanField label="IMEI / Serial" name="serial_imei" value={serial} onCodeChange={setSerial} placeholder="Scan or type the IMEI / serial number" hint={result} />
    </>
  );
}
