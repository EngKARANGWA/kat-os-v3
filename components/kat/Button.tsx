import Link from "next/link";
import { Button as UIButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UIButtonProps = React.ComponentProps<typeof UIButton>;
type ButtonProps = UIButtonProps & { full?: boolean };

/** KAT button (shadcn/ui). `full` makes it span the whole row of a grid form. */
export function Button({ className, full, size = "lg", ...props }: ButtonProps) {
  return <UIButton size={size} className={cn(full && "sm:col-span-2", className)} {...props} />;
}

type LinkButtonProps = {
  href: string;
  children: React.ReactNode;
  /** Use for files served by the API (PDFs): a normal download link instead of an in-app page change. */
  native?: boolean;
  icon?: React.ReactNode;
  variant?: UIButtonProps["variant"];
  className?: string;
};

/** A link that looks like a button. */
export function LinkButton({ href, children, native, icon, variant, className }: LinkButtonProps) {
  return (
    <UIButton asChild size="lg" variant={variant} className={className}>
      {native ? (
        <a href={href}>
          {icon}
          {children}
        </a>
      ) : (
        <Link href={href}>
          {icon}
          {children}
        </Link>
      )}
    </UIButton>
  );
}
