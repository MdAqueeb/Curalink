const EXAMPLE_PROMPTS = [
  "Latest Deep Brain Stimulation treatments for Parkinson's disease",
  "CRISPR gene therapy for sickle cell disease — current trials",
  "Prevention strategies for Type 2 diabetes in adults over 40",
];

export function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16">
      <div className="h-14 w-14 rounded-2xl bg-brand-600 flex items-center justify-center mb-4">
        <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Ask anything about a disease or treatment
      </h2>
      <p className="text-slate-500 text-sm mb-8 max-w-md">
        Curalink searches PubMed, OpenAlex, and ClinicalTrials.gov, then uses AI to synthesize the findings into structured research insights.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-lg">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptClick(prompt)}
            className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50 text-sm text-slate-600 hover:text-brand-700 transition-colors"
          >
            <span className="text-brand-400 mr-2">→</span>
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
