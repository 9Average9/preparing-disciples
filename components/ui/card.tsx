import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className, onClick, hoverable }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-bg-surface border border-border-subtle rounded-2xl transition-all duration-200",
        hoverable &&
          "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-text-muted/25",
        onClick && "cursor-pointer",
        className
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn("px-5 py-4 border-b border-border-subtle", className)}>
      {children}
    </div>
  );
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-border-subtle bg-bg-elevated/50 rounded-b-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}
