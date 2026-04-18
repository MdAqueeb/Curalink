import { useState } from "react";
import { ConditionOverview } from "./ConditionOverview";
import { InsightCard } from "./InsightCard";
import { TrialCard } from "./TrialCard";
import { SourceList } from "./SourceList";
import { MetadataBar } from "./MetadataBar";
import { WarningBanner } from "./WarningBanner";
import type { ClinicalTrialItem, ResearchInsight, ResearchResponse } from "@/types/api";

export function ResearchResult({ response }: { response: ResearchResponse }) {
  const [highlightedRef, setHighlightedRef] = useState<string | null>(null);
  const warnings = response.metadata.warnings ?? [];

  const handleSourceClick = (refId: string) => {
    setHighlightedRef(refId);
    const el = document.getElementById(`source-${refId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightedRef(null), 2000);
    } else {
      const sourceList = document.getElementById("source-list-toggle");
      sourceList?.click();
      setTimeout(() => {
        document.getElementById(`source-${refId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => setHighlightedRef(null), 2000);
      }, 100);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <WarningBanner warnings={warnings} />
      <ConditionOverview data={response.conditionOverview} />

      {response.researchInsights.length > 0 && (
        <section className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Research Insights ({response.researchInsights.length})
          </h3>
          {response.researchInsights.map((ins: ResearchInsight) => (
            <InsightCard key={ins.insightId} insight={ins} onSourceClick={handleSourceClick} />
          ))}
        </section>
      )}

      {response.clinicalTrials.length > 0 && (
        <section className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Clinical Trials ({response.clinicalTrials.length})
          </h3>
          {response.clinicalTrials.map((t: ClinicalTrialItem) => (
            <TrialCard key={t.nctId} trial={t} />
          ))}
        </section>
      )}

      <SourceList sources={response.sources} highlightedRefId={highlightedRef} />
      <MetadataBar metadata={response.metadata} />

      {response.disclaimer && (
        <p className="mt-3 text-xs text-slate-300 italic">{response.disclaimer}</p>
      )}
    </div>
  );
}
