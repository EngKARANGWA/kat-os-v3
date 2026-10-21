import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PanelProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

/** White content card (shadcn/ui Card) with an optional title, description and action button. */
export function Panel({ title, description, action, className, children }: PanelProps) {
  return (
    <Card className={cn("gap-4", className)}>
      {(title || action) && (
        <CardHeader>
          {title && <CardTitle className="text-lg font-semibold">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Page title with an optional description and an action on the right, e.g. "+ New Repair". */
export function PageHeader({ title, description, action }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Wide left column and narrow right column (stacked on small screens). */
export function TwoColumns({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">{left}</div>
      <div className="flex flex-col gap-6">{right}</div>
    </div>
  );
}

/** Vertical stack of cards with even spacing. */
export function Stack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-6", className)}>{children}</div>;
}

/** A "Label: value" line, e.g. on the repair details card. */
export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="min-w-36 text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
