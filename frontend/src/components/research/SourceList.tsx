import { useState } from "react";
import type { SourceItem } from "@/types/api";

interface SourceListProps {
  sources: SourceItem[];
  highlightedRefId?: string | null;
}

export function SourceList({ sources, highlightedRefId }: SourceListProps) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          Sources ({sources.length})
        </span>
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {sources.map((s, i) => (
            <div
              key={s.refId}
              id={`source-${s.refId}`}
              className={`px-4 py-3 text-sm transition-colors ${
                highlightedRefId === s.refId ? "bg-brand-50" : "bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-slate-900 hover:text-brand-600 line-clamp-2 transition-colors"
                  >
                    {s.title}
                  </a>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-slate-400">
                    {s.authors && s.authors.length > 0 && (
                      <span>{s.authors.slice(0, 3).join(", ")}{s.authors.length > 3 ? " et al." : ""}</span>
                    )}
                    {s.journal && <span className="italic">{s.journal}</span>}
                    {s.year && <span>{s.year}</span>}
                    {s.citationCount !== undefined && s.citationCount > 0 && (
                      <span className="text-slate-300">· {s.citationCount} citations</span>
                    )}
                    {s.doi && (
                      <a
                        href={`https://doi.org/${s.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-500 hover:underline"
                      >
                        DOI
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
