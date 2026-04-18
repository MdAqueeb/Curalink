import { cn } from "@/lib/utils";

const variants = {
  high: "bg-green-100 text-green-800 border border-green-200",
  moderate: "bg-amber-100 text-amber-800 border border-amber-200",
  low: "bg-red-100 text-red-800 border border-red-200",
  default: "bg-slate-100 text-slate-700 border border-slate-200",
  blue: "bg-brand-100 text-brand-700 border border-brand-200",
  recruiting: "bg-green-100 text-green-800 border border-green-200",
  completed: "bg-blue-100 text-blue-800 border border-blue-200",
  active: "bg-amber-100 text-amber-800 border border-amber-200",
};

interface BadgeProps {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function trialStatusVariant(status: string): keyof typeof variants {
  const s = status.toUpperCase();
  if (s === "RECRUITING") return "recruiting";
  if (s === "COMPLETED") return "completed";
  if (s.includes("ACTIVE")) return "active";
  return "default";
}
