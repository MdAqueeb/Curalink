import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = { none: "", sm: "p-3", md: "p-4", lg: "p-6" };

export function Card({ children, className, padding = "md" }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-[--radius-card] border border-slate-200 shadow-sm",
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
