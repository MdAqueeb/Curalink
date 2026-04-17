import type { IntentObject, QueryType, RawInput, TemporalBias } from "../types/domain.js";
import { QUERY_TYPE_ENRICHMENT } from "../config/constants.js";
import { detectDiseaseInText, expandSynonyms, normalizeTerm } from "./meshNormalizer.js";

const TEMPORAL_RECENT = ["latest", "recent", "new", "current", "modern", "2023", "2024", "2025"];
const TEMPORAL_SEMINAL = ["seminal", "foundational", "landmark", "classic", "original"];

function detectTemporalBias(text: string): TemporalBias {
  const lower = text.toLowerCase();
  if (TEMPORAL_RECENT.some((k) => lower.includes(k))) return "recent";
  if (TEMPORAL_SEMINAL.some((k) => lower.includes(k))) return "seminal";
  return "all-time";
}

function detectQueryType(text: string, explicit?: QueryType): QueryType {
  if (explicit && explicit !== "general") return explicit;
  const lower = text.toLowerCase();
  if (/\btreat|therap|drug|medication|management|intervention\b/.test(lower)) return "treatment";
  if (/\bmechan|pathophysiol|pathway|how does\b/.test(lower)) return "mechanism";
  if (/\btrial|study|recruit|nct\b/.test(lower)) return "trial";
  if (/\bprevent|prophyla|risk reduc\b/.test(lower)) return "prevention";
  return explicit ?? "general";
}

function detectConcept(text: string, disease: string): string {
  const lower = text.toLowerCase();
  const diseaseLower = disease.toLowerCase();
  // Strip the disease itself, then use the remainder as the clinical concept signal.
  const cleaned = lower.replace(diseaseLower, "").replace(/\s+/g, " ").trim();
  // Simple heuristic: pick a noun-phrase-like span (longest 1-3 word window with letters).
  const tokens = cleaned.split(/[^a-zA-Z0-9-]+/).filter((t) => t.length > 2 && !STOP.has(t));
  if (tokens.length === 0) return "treatment";
  // Take up to 3 leading content tokens.
  return tokens.slice(0, 3).join(" ");
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "what",
  "are",
  "latest",
  "current",
  "best",
  "new",
  "recent",
  "about",
  "give",
  "tell",
  "show",
  "from",
  "into",
  "patient",
  "patients",
  "people",
  "treatment",
  "treatments",
  "study",
  "studies",
  "research",
  "evidence",
]);

export function processInput(input: RawInput): IntentObject {
  const rawText = (input.message ?? `${input.disease ?? ""} ${input.query ?? ""}`).trim();

  const diseaseRaw = input.disease?.trim() || detectDiseaseInText(rawText) || "";
  const primaryDisease = diseaseRaw ? normalizeTerm(diseaseRaw) : "";

  const conceptRaw = input.query?.trim() || detectConcept(rawText, primaryDisease);
  const clinicalConcept = normalizeTerm(conceptRaw || "treatment");

  const queryType = detectQueryType(rawText, input.queryType);
  const temporalBias = detectTemporalBias(rawText);

  const diseaseSyns = primaryDisease ? expandSynonyms(primaryDisease) : [];
  const conceptSyns = expandSynonyms(clinicalConcept);
  const enrichment = QUERY_TYPE_ENRICHMENT[queryType];

  const expandedTerms = [...new Set([...diseaseSyns, ...conceptSyns, ...enrichment])];

  const queries = buildQueries(primaryDisease, clinicalConcept, diseaseSyns, conceptSyns);

  return {
    primaryDisease,
    clinicalConcept,
    temporalBias,
    queryType,
    rawInput: rawText,
    expandedTerms,
    queries,
    userAge: input.userAge,
  };
}

function buildQueries(
  disease: string,
  concept: string,
  diseaseSyns: string[],
  conceptSyns: string[]
): string[] {
  const orList = (arr: string[]) => arr.map((t) => `"${t}"`).join(" OR ");
  const safeDisease = disease || "medicine";
  const safeConcept = concept || "treatment";

  const dSyns = diseaseSyns.length ? diseaseSyns : [safeDisease];
  const cSyns = conceptSyns.length ? conceptSyns : [safeConcept];

  return [
    // Q0: most specific — for PubMed
    `"${safeConcept}" AND "${safeDisease}"`,
    // Q1: synonym-expanded primary — for OpenAlex
    `(${orList(cSyns)}) AND (${orList(dSyns)})`,
    // Q2: broader sweep
    `"${safeDisease}" AND (${orList(cSyns.slice(0, 4))})`,
    // Q3: trial-targeted
    `"${safeDisease}" AND "${safeConcept}" AND "clinical trial"`,
  ];
}
