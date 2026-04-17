import type { QueryType } from "../types/domain.js";

export const SOURCE_CREDIBILITY: Record<string, number> = {
  pubmed: 1.0,
  openalex: 0.85,
  clinicaltrials: 0.9,
};

export const QUERY_TYPE_ENRICHMENT: Record<QueryType, string[]> = {
  treatment: ["therapy", "intervention", "management", "clinical outcome"],
  mechanism: ["pathophysiology", "mechanism of action", "molecular pathway"],
  trial: ["randomized controlled trial", "phase III", "clinical study"],
  prevention: ["prevention", "prophylaxis", "risk reduction"],
  general: [],
};

export const DEFAULT_DISCLAIMER =
  "This response is for research and informational purposes only and does not constitute medical advice. Consult a qualified healthcare provider for diagnosis and treatment decisions.";

export const FALLBACK_JOURNAL_TIER_SCORE = 0.35;
