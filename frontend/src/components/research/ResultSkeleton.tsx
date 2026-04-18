import { Skeleton } from "@/components/ui/Skeleton";

export function ResultSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>

      <div className="space-y-1 pt-2">
        <Skeleton className="h-3 w-28" />
      </div>

      {[1, 2, 3].map((i) => (
        <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <div className="flex gap-1 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}

      {[1, 2].map((i) => (
        <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-20 rounded-full shrink-0" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}

      <div className="flex gap-4 pt-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}
