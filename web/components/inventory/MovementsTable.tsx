"use client";

import { DataTable, useFilters } from "@/components/kat";
import { TicketLink } from "@/components/repairs/columns";
import { fmtDateTime } from "@/lib/format";
import type { StockMovement } from "@/lib/types";

/** History of every stock change, with search and filters. */
export function MovementsTable({ movements }: { movements: StockMovement[] }) {
  const { rows, bar, filtering } = useFilters(
    movements,
    {
      placeholder: "Search SKU, item, note, ticket, staff…",
      search: (m) => [m.sku, m.item_name, m.note, m.ticket_code, m.created_by, m.reason],
      filters: [
        {
          kind: "select",
          key: "direction",
          label: "Movements",
          value: (m) => m.direction,
          options: [
            { value: "in", label: "Checked in" },
            { value: "out", label: "Checked out" },
          ],
        },
        { kind: "select", key: "reason", label: "Reasons", value: (m) => m.reason },
        { kind: "select", key: "by", label: "Staff", value: (m) => m.created_by },
        { kind: "dates", key: "date", label: "Date", value: (m) => m.created_at },
      ],
    },
    "movements",
  );
  const inTotal = rows.filter((m) => m.direction === "in").reduce((s, m) => s + m.quantity, 0);
  const outTotal = rows.filter((m) => m.direction === "out").reduce((s, m) => s + m.quantity, 0);

  return (
    <>
      {bar}
      <p className="mb-3 text-sm text-muted-foreground">
        {filtering ? "Shown" : "All"}: <b className="text-emerald-700">+{inTotal} in</b> · <b className="text-amber-700">−{outTotal} out</b>
      </p>
      <DataTable
        rows={rows}
        rowKey={(m) => m.id}
        empty={filtering ? "No movements match these filters." : "No stock movements yet. Use Check In / Check Out."}
        columns={[
          { header: "Date", cell: (m) => <span className="whitespace-nowrap">{fmtDateTime(m.created_at)}</span> },
          {
            header: "Item",
            cell: (m) => (
              <div>
                <div className="font-medium">{m.item_name}</div>
                <div className="font-mono text-xs text-muted-foreground">{m.sku}</div>
              </div>
            ),
          },
          {
            header: "Change",
            cell: (m) => (
              <span data-change className={m.direction === "in" ? "font-semibold text-emerald-700 tabular-nums" : "font-semibold text-amber-700 tabular-nums"}>
                {m.direction === "in" ? "+" : "−"}
                {m.quantity}
              </span>
            ),
          },
          {
            header: "Reason",
            cell: (m) => (
              <div>
                <div>{m.reason}</div>
                {m.ticket_code && m.repair_id && <TicketLink id={m.repair_id} code={m.ticket_code} />}
              </div>
            ),
          },
          { header: "Note", cell: (m) => m.note || "—" },
          { header: "Stock after", cell: (m) => m.balance_after ?? "—" },
          { header: "By", cell: (m) => m.created_by },
        ]}
      />
    </>
  );
}
