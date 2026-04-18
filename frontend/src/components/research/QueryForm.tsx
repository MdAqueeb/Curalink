import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import type { PipelineMode, QueryType } from "@/types/api";

export interface QueryFormData {
  message: string;
  disease: string;
  query: string;
  queryType: QueryType;
  mode: PipelineMode;
  userAge: number | undefined;
}

interface QueryFormProps {
  onSubmit: (data: QueryFormData) => void;
  isLoading: boolean;
  hasSession: boolean;
}

const queryTypeOptions = [
  { value: "general", label: "General" },
  { value: "treatment", label: "Treatment" },
  { value: "mechanism", label: "Mechanism" },
  { value: "trial", label: "Clinical Trial" },
  { value: "prevention", label: "Prevention" },
];

const modeOptions = [
  { value: "standard", label: "Standard" },
  { value: "brief", label: "Brief" },
  { value: "deep", label: "Deep" },
  { value: "high_quality", label: "High Quality" },
];

export function QueryForm({ onSubmit, isLoading, hasSession }: QueryFormProps) {
  const [message, setMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [disease, setDisease] = useState("");
  const [query, setQuery] = useState("");
  const [queryType, setQueryType] = useState<QueryType>("general");
  const [mode, setMode] = useState<PipelineMode>("standard");
  const [userAge] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !disease.trim() && !query.trim()) return;
    onSubmit({
      message: message.trim(),
      disease: disease.trim(),
      query: query.trim(),
      queryType,
      mode,
      userAge: userAge ? parseInt(userAge, 10) : undefined,
    });
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border-t border-slate-200 px-4 pt-3 pb-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 items-end">
          <div className="flex-1 rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-transparent transition-all">
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasSession
                  ? "Ask a follow-up question… (Enter to send)"
                  : "Ask about a disease or treatment… (Enter to send)"
              }
              disabled={isLoading}
              className="w-full resize-none rounded-t-xl px-4 pt-3 pb-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 bg-transparent"
            />
            <div className="flex items-center justify-between px-3 pb-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <svg className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Advanced options
              </button>
              <span className="text-xs text-slate-300">Shift+Enter for newline</span>
            </div>
          </div>
          <Button type="submit" loading={isLoading} size="md" className="mb-0.5 self-end">
            {isLoading ? "Researching…" : hasSession ? "Follow up" : "Research"}
          </Button>
        </div>

        {showAdvanced && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-slate-600 block mb-1">Disease</label>
              <input
                type="text"
                value={disease}
                onChange={(e) => setDisease(e.target.value)}
                placeholder="e.g. Parkinson's"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-slate-600 block mb-1">Concept</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Deep brain stimulation"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <Select
              label="Query type"
              value={queryType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setQueryType(e.target.value as QueryType)}
              options={queryTypeOptions}
              className="text-xs py-1.5"
            />
            <Select
              label="Mode"
              value={mode}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMode(e.target.value as PipelineMode)}
              options={modeOptions}
              className="text-xs py-1.5"
            />
          </div>
        )}
      </div>
    </form>
  );
}
