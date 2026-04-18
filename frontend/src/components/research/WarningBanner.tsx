import { Alert } from "@/components/ui/Alert";

const WARNING_MESSAGES: Record<string, string> = {
  llm_fallback_mode: "AI model is busy — insights auto-extracted from abstracts (citations verified).",
  ollama_unreachable: "AI model is offline — partial results shown.",
  llm_invalid_json: "AI returned unexpected output — insights may be incomplete.",
  no_insights_generated: "No research insights could be generated for this query.",
  reranker_disabled: "High-quality reranker is coming in v2.",
  min_corpus_size_not_met: "Fewer sources retrieved than expected — results may be limited.",
};

function resolveMessage(warning: string): string {
  if (WARNING_MESSAGES[warning]) return WARNING_MESSAGES[warning];
  if (warning.startsWith("retrieval_error:")) {
    const src = warning.split(":")[1];
    return `${src.charAt(0).toUpperCase() + src.slice(1)} source unavailable for this query.`;
  }
  if (warning.startsWith("uncited_insight:")) {
    return "Some claims could not be verified against retrieved sources.";
  }
  return warning;
}

export function WarningBanner({ warnings }: { warnings: string[] }) {
  if (!warnings || warnings.length === 0) return null;

  const unique = [...new Set(warnings.map(resolveMessage))];

  return (
    <Alert variant="warning" title="Notice" className="mb-4">
      <ul className="list-disc list-inside space-y-0.5">
        {unique.map((msg) => (
          <li key={msg}>{msg}</li>
        ))}
      </ul>
    </Alert>
  );
}
