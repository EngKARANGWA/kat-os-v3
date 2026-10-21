"use client";

import { Download } from "lucide-react";
import { DataTable, useFilters } from "@/components/kat";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime, money } from "@/lib/format";
import type { Sale } from "@/lib/types";

/** Every Check Out receipt, with search, filters and a download link. */
export function ReceiptsTable({ sales }: { sales: Sale[] }) {
  const { rows, bar, filtering } = useFilters(
    sales,
    {
      placeholder: "Search receipt no., customer, phone, item, serial number…",
      search: (s) => [s.number, s.customer_name, s.customer_phone, s.service_name, s.created_by, ...s.lines.flatMap((l) => [l.description, l.code, l.device_serial])],
      filters: [
        {
          kind: "select",
          key: "purpose",
          label: "Purposes",
          value: (s) => s.purpose,
          options: [
            { value: "sale", label: "Sale" },
            { value: "repair", label: "Repair" },
          ],
        },
        { kind: "select", key: "pay", label: "Payments", value: (s) => s.payment_method },
        { kind: "select", key: "by", label: "Staff", value: (s) => s.created_by },
        { kind: "dates", key: "date", label: "Date", value: (s) => s.created_at },
      ],
    },
    "receipts",
  );
  const total = rows.reduce((n, s) => n + s.total, 0);

  return (
    <>
      {bar}
      <p className="mb-3 text-sm text-muted-foreground">
        {filtering ? "Shown" : "All"}: <b data-testid="receipts-total" className="text-foreground">{money(total)} RWF</b> in {rows.length} receipts
      </p>
      <DataTable
        rows={rows}
        rowKey={(s) => s.id}
        empty={filtering ? "No receipts match these filters." : "No receipts yet. They are created by Check Out."}
        columns={[
          { header: "Receipt", cell: (s) => <span className="font-mono font-medium">{s.number}</span> },
          { header: "Date", cell: (s) => <span className="whitespace-nowrap">{fmtDateTime(s.created_at)}</span> },
          {
            header: "For",
            cell: (s) => (
              <div>
                <Badge className={s.purpose === "sale" ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"}>{s.purpose === "sale" ? "Sale" : "Repair"}</Badge>
                {s.service_name && <div className="mt-0.5 text-xs text-muted-foreground">{s.service_name}</div>}
              </div>
            ),
          },
          { header: "Customer", cell: (s) => [s.customer_name, s.customer_phone].filter(Boolean).join(" · ") || "—" },
          { header: "Items", cell: (s) => s.items_total },
          { header: "Amount", cell: (s) => <span className="font-medium tabular-nums">{money(s.total)} RWF</span> },
          { header: "Payment", cell: (s) => s.payment_method || "—" },
          { header: "By", cell: (s) => s.created_by },
          {
            header: "",
            cell: (s) => (
              <a
                href={`/api/sales/${s.id}/receipt.pdf`}
                aria-label={`Download receipt ${s.number}`}
                className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs whitespace-nowrap hover:border-primary hover:text-primary"
              >
                <Download className="size-3" />
                PDF
              </a>
            ),
          },
        ]}
      />
    </>
  );
}
