import { Badge } from "@/components/ui/Badge";
import type { ConditionOverview as IConditionOverview, EvidenceLevel } from "@/types/api";

function evidenceLabel(level: EvidenceLevel) {
  return `${level.charAt(0).toUpperCase() + level.slice(1)} evidence`;
}

export function ConditionOverview({ data }: { data: IConditionOverview }) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h2 className="text-xl font-bold text-slate-900">{data.disease}</h2>
        <Badge variant={data.evidenceLevel}>{evidenceLabel(data.evidenceLevel)}</Badge>
      </div>
      {data.subtypes && data.subtypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.subtypes.map((s: string) => (
            <Badge key={s} variant="default">{s}</Badge>
          ))}
        </div>
      )}
      <p className="text-slate-600 leading-relaxed text-sm">{data.summary}</p>
    </div>
  );
}
