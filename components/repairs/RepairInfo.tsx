import { Smartphone } from "lucide-react";
import { Detail, Panel, StatusBadge } from "@/components/kat";
import { Separator } from "@/components/ui/separator";
import type { Repair } from "@/lib/types";

/** Device, client, intake details and the T&Cs the customer accepted. */
export function RepairInfo({ repair: r }: { repair: Repair }) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Smartphone className="size-5 text-primary" />
          {r.device}
        </span>
      }
      action={<StatusBadge status={r.status} />}
    >
      <dl className="flex flex-col gap-2 text-sm">
        <Detail label="Client">
          {r.client_name} · {r.client_phone}
        </Detail>
        <Detail label="IMEI/Serial">{r.serial_imei || "—"}</Detail>
        <Detail label="Problem">{r.problem_category}</Detail>
        <Detail label="Intake condition">{r.condition_in || "—"}</Detail>
        <Detail label="Deadline">{r.deadline || "—"}</Detail>
        <Detail label="Warranty until">{r.warranty_until || "Starts when collected"}</Detail>
      </dl>
      <Separator className="my-4" />
      <h3 className="mb-2 text-sm font-semibold">T&amp;Cs</h3>
      <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{r.terms_snapshot}</pre>
      <p className="mt-3 text-sm">
        <span className="text-muted-foreground">Accepted by:</span> <span className="font-medium">{r.customer_acceptance || "Not recorded"}</span>
      </p>
    </Panel>
  );
}
