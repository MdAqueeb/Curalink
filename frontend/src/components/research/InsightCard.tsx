import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import type { ResearchInsight } from "@/types/api";

interface InsightCardProps {
  insight: ResearchInsight;
  onSourceClick: (refId: string) => void;
}

export function InsightCard({ insight, onSourceClick }: InsightCardProps) {
  return (
    <Card className="mb-3">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <p className="font-medium text-slate-900 text-sm leading-snug flex-1">{insight.claim}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {insight.year && (
            <span className="text-xs text-slate-400">{insight.year}</span>
          )}
          <Badge variant={insight.confidence}>{insight.confidence}</Badge>
        </div>
      </div>

      {insight.detail && (
        <p className="text-slate-500 text-sm leading-relaxed mb-2">{insight.detail}</p>
      )}

      {insight.sourceRefs.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {insight.sourceRefs.map((ref: string) => (
            <button
              key={ref}
              onClick={() => onSourceClick(ref)}
              className="inline-flex items-center rounded-full bg-brand-50 border border-brand-200 px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
            >
              {ref.startsWith("https://openalex") ? `OA:${ref.slice(-6)}` : ref.slice(0, 10)}
            </button>
          ))}
        </div>
      )}

      {insight.citationWarning && (
        <Alert variant="warning" className="mt-2 text-xs">
          {insight.citationWarning}
        </Alert>
      )}
    </Card>
  );
}
