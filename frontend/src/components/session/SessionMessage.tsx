import { ResearchResult } from "@/components/research/ResearchResult";
import type { StoredTurn } from "@/types/api";

export function SessionMessage({ turn }: { turn: StoredTurn }) {
  return (
    <div className="mb-8">
      <div className="flex items-start gap-3 mb-4">
        <div className="shrink-0 h-7 w-7 rounded-full bg-brand-600 flex items-center justify-center">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <div className="bg-brand-600 text-white rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-xl">
          {turn.userMessage}
        </div>
      </div>

      <div className="ml-10">
        <ResearchResult response={turn.response} />
      </div>
    </div>
  );
}
