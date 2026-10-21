import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert as UIAlert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Inline message box (shadcn/ui Alert). */
export function Alert({ kind = "error", children }: { kind?: "error" | "success"; children: React.ReactNode }) {
  return (
    <UIAlert variant={kind === "error" ? "destructive" : "default"} className="mb-4">
      {kind === "error" ? <CircleAlert /> : <CircleCheck />}
      <AlertDescription className={kind === "error" ? "text-destructive" : undefined}>{children}</AlertDescription>
    </UIAlert>
  );
}

/** Placeholder lines shown while data loads. */
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 py-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-5", i % 3 === 2 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

// One colour per repair status, so the board can be read at a glance.
const STATUS_STYLES: Record<string, string> = {
  Received: "bg-slate-100 text-slate-700",
  Diagnosing: "bg-sky-100 text-sky-800",
  "Waiting for Approval": "bg-amber-100 text-amber-800",
  Repairing: "bg-indigo-100 text-indigo-800",
  Ready: "bg-emerald-100 text-emerald-800",
  Collected: "bg-teal-100 text-teal-800",
  Cancelled: "bg-rose-100 text-rose-800",
};

/** Repair status pill (shadcn/ui Badge), coloured by status. */
export function StatusBadge({ status }: { status: string }) {
  return <Badge className={cn("rounded-full", STATUS_STYLES[status] ?? "bg-secondary text-secondary-foreground")}>{status}</Badge>;
}

/**
 * Shows an error, a loading placeholder, or the loaded data — the three states of every API call.
 *   <Async data={data} error={error}>{(d) => <Table rows={d.items} />}</Async>
 */
export function Async<T>({ data, error, children }: { data: T | null; error: string | null; children: (data: T) => React.ReactNode }) {
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  return <>{children(data)}</>;
}
