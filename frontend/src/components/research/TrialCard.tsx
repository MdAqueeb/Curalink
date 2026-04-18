import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge, trialStatusVariant } from "@/components/ui/Badge";
import type { ClinicalTrialItem } from "@/types/api";

export function TrialCard({ trial }: { trial: ClinicalTrialItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-3">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex-1 min-w-0">
          <a
            href={trial.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-mono text-brand-600 hover:underline mb-1"
          >
            {trial.nctId}
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
          <p className="text-sm font-medium text-slate-900 leading-snug">{trial.title}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={trialStatusVariant(trial.status)}>{trial.status}</Badge>
          {trial.phase && trial.phase !== "N/A" && (
            <Badge variant="default">{trial.phase}</Badge>
          )}
        </div>
      </div>

      {trial.summary && (
        <div className="mt-2">
          <p className={`text-sm text-slate-500 leading-relaxed ${!expanded ? "line-clamp-3" : ""}`}>
            {trial.summary}
          </p>
          {trial.summary.length > 200 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-brand-600 hover:underline mt-1"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {trial.relevanceNote && (
        <p className="mt-2 text-xs text-slate-400 italic">{trial.relevanceNote}</p>
      )}
    </Card>
  );
}
