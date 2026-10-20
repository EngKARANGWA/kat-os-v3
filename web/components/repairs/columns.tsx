import Link from "next/link";
import { StatusBadge, type Column } from "@/components/kat";
import { fmtDate, money } from "@/lib/format";
import type { RepairSummary } from "@/lib/types";

/** Ticket number as a link to the repair page. */
export function TicketLink({ id, code }: { id: number; code: string }) {
  return (
    <Link href={`/repairs/${id}`} className="font-medium text-primary hover:underline">
      {code}
    </Link>
  );
}

/** Reusable repair table columns; each page picks the ones it needs. */
export const repairColumns = {
  ticket: { header: "Ticket", cell: (r) => <TicketLink id={r.id} code={r.ticket_code} /> },
  ticketText: { header: "Ticket", cell: (r) => <span className="font-medium">{r.ticket_code}</span> },
  client: { header: "Client", cell: (r) => r.client_name },
  device: { header: "Device", cell: (r) => r.device },
  problem: { header: "Problem", cell: (r) => r.problem_category },
  technician: { header: "Technician", cell: (r) => r.technician || "—" },
  status: { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  deadline: { header: "Deadline", cell: (r) => r.deadline || "—" },
  balance: {
    header: "Balance",
    cell: (r) =>
      r.balance > 0 && r.status !== "Cancelled" ? <span className="font-medium text-destructive tabular-nums">{money(r.balance)}</span> : <span className="text-muted-foreground">Paid</span>,
  },
  date: { header: "Date", cell: (r) => fmtDate(r.created_at) },
} satisfies Record<string, Column<RepairSummary>>;
