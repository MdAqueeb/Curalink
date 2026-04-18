import { cn } from "@/lib/utils";

const variants = {
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  error: "bg-red-50 border-red-200 text-red-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
  success: "bg-green-50 border-green-200 text-green-800",
};

interface AlertProps {
  variant?: keyof typeof variants;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ variant = "info", title, children, className }: AlertProps) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 text-sm", variants[variant], className)}>
      {title && <p className="font-medium mb-0.5">{title}</p>}
      <div>{children}</div>
    </div>
  );
}
