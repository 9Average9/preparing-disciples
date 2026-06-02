import { cn } from "@/lib/utils";

type BadgeVariant = "draft" | "complete" | "default";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  draft: "bg-text-muted/10 text-text-muted border border-text-muted/20",
  complete: "bg-success/10 text-success border border-success/20",
  default: "bg-accent/10 text-accent border border-accent/20",
};

export function Badge({
  variant = "default",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase rounded-full",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export type { BadgeVariant, BadgeProps };
