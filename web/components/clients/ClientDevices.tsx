"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Smartphone } from "lucide-react";
import { ApiForm, DataTable, Field, Panel, ScanField, SelectField, SubmitButton } from "@/components/kat";
import { useFlash } from "@/components/Flash";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import { DEVICE_CATEGORIES } from "@/lib/constants";
import type { Device } from "@/lib/types";

/** A client's devices, with an "Add Device" button that opens the form in a pop-up. A duplicate IMEI/serial opens the client who already owns it. */
export function ClientDevices({ clientId, clientName, devices, onChange }: { clientId: number; clientName: string; devices: Device[]; onChange: () => Promise<void> }) {
  const router = useRouter();
  const flash = useFlash();
  const [open, setOpen] = useState(false);

  async function addDevice(values: Record<string, string>) {
    try {
      return await api(`/clients/${clientId}/devices`, { body: values });
    } catch (err) {
      // Device belongs to another client: say so and open that client.
      if (err instanceof ApiError && err.status === 409 && err.data.existing_client_id && err.data.existing_client_id !== clientId) {
        flash(err.message, "error");
        setOpen(false);
        router.push(`/clients/${err.data.existing_client_id}`);
        return null;
      }
      if (err instanceof ApiError && err.status === 409 && err.data.existing_client_id === clientId) {
        throw new Error(`This IMEI / serial is already registered for ${clientName}.`);
      }
      throw err;
    }
  }

  return (
    <Panel
      title="Devices"
      action={
        <Button size="lg" onClick={() => setOpen(true)}>
          <Plus />
          Add Device
        </Button>
      }
    >
      <DataTable
        rows={devices}
        rowKey={(d) => d.id}
        empty="No devices registered. Click “Add Device” to add one."
        columns={[
          { header: "Type", cell: (d) => d.category },
          { header: "Model", cell: (d) => d.model },
          { header: "IMEI / Serial", cell: (d) => <span className="font-mono text-xs">{d.serial_imei || "—"}</span> },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="size-5 text-primary" />
              Add Device
            </DialogTitle>
            <DialogDescription>A device that belongs to {clientName}.</DialogDescription>
          </DialogHeader>
          <ApiForm
            action={addDevice}
            onSuccess={async (result) => {
              if (result === null) return; // went to the other owner's page
              setOpen(false);
              flash("Device added.");
              await onChange();
            }}
          >
            <SelectField label="Category" name="category" options={DEVICE_CATEGORIES} />
            <Field label="Model" name="model" required autoFocus placeholder="e.g. iPhone 15 Pro Max" />
            <ScanField label="IMEI / Serial (optional for MacBook)" name="serial_imei" placeholder="Scan or type" hint="If this IMEI / serial is already registered, its owner is opened instead." />
            <SubmitButton full icon={<Plus />} className="w-full">
              Add Device
            </SubmitButton>
          </ApiForm>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
