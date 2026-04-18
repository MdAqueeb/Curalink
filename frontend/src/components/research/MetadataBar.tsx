import { formatLatency } from "@/lib/utils";
import type { ResponseMetadata } from "@/types/api";

export function MetadataBar({ metadata }: { metadata: ResponseMetadata }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 border-t border-slate-100 pt-3">
      <span title="Total documents retrieved from all sources">
        Retrieved <strong className="text-slate-500">{metadata.retrievedCount}</strong>
      </span>
      <span title="Documents after ranking / top-K">
        Ranked <strong className="text-slate-500">{metadata.rankedCount}</strong>
      </span>
      <span title="End-to-end pipeline latency">
        {formatLatency(metadata.latencyMs)}
      </span>
      <span
        className={metadata.cacheHit ? "text-green-600" : "text-slate-400"}
        title="Whether retrieval was served from cache"
      >
        {metadata.cacheHit ? "Cache HIT" : "Cache MISS"}
      </span>
      {metadata.retrievalSources.length > 0 && (
        <span title="Sources that returned results">
          {metadata.retrievalSources.join(" · ")}
        </span>
      )}
      {metadata.modelUsed && (
        <span className="text-slate-300" title="LLM model used for reasoning">
          {metadata.modelUsed}
        </span>
      )}
    </div>
  );
}
