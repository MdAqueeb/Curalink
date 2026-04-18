export type QueryType = "treatment" | "mechanism" | "trial" | "prevention" | "general";
export type TemporalBias = "recent" | "all-time" | "seminal";
export type PipelineMode = "brief" | "standard" | "deep" | "high_quality";

export interface RawInput {
  disease?: string;
  query?: string;
  message?: string;
  userAge?: number;
  queryType?: QueryType;
  sessionId?: string;
  mode?: PipelineMode;
}

export interface ConversationHistoryItem {
  userMessage: string;
  assistantSummary: string;
}

export interface IntentObject {
  primaryDisease: string;
  clinicalConcept: string;
  temporalBias: TemporalBias;
  queryType: QueryType;
  rawInput: string;
  expandedTerms: string[];
  queries: string[];
  inheritedFromContext?: boolean;
  conversationHistory?: ConversationHistoryItem[];
  userAge?: number;
  patientSummary?: string;   // structured clinical description built from the raw input
  bodyPart?: string;         // primary body part mentioned (e.g. "hand", "knee")
  triggerEvent?: string;     // precipitating event (e.g. "fall", "injury")
  activity?: string;         // physical/sports activity context (e.g. "football", "running")
  onset?: string;            // symptom onset character (e.g. "sudden", "gradual")
  searchQuery?: string;      // clean rewritten medical query used for retrieval
}

export interface Publication {
  source: "openalex" | "pubmed";
  id: string;
  doi?: string | null;
  pmid?: string | null;
  title: string;
  abstract: string;
  year: number | null;
  citationCount?: number;
  journal: string;
  url: string;
  authors: string[];
}

export interface Trial {
  source: "clinicaltrials";
  id: string;
  nctId: string;
  title: string;
  summary: string;
  status: string;
  phase: string;
  startDate?: string | null;
  completionDate?: string | null;
  enrollment?: number | null;
  url: string;
}

export interface RetrievalError {
  source: string;
  message: string;
}

export interface RetrievalBundle {
  publications: Publication[];
  trials: Trial[];
  retrievalErrors: RetrievalError[];
  cacheHit: boolean;
}

export interface RankingSignals {
  bm25: number;
  bm25Norm: number;
  semantic: number;
  semanticNorm: number;
  recency: number;
  credibility: number;
  composite: number;
}

export interface RankedDoc {
  doc: Publication;
  signals: RankingSignals;
}

export interface ConditionOverview {
  disease: string;
  subtypes?: string[];
  summary: string;
  evidenceLevel: "high" | "moderate" | "low";
}

export interface ResearchInsight {
  insightId: string;
  claim: string;
  detail?: string;
  sourceRefs: string[];
  confidence: "high" | "moderate" | "low";
  year?: number | null;
  citationWarning?: string;
}

export interface ClinicalTrialItem {
  nctId: string;
  title: string;
  status: string;
  phase: string;
  summary?: string;
  url: string;
  relevanceNote?: string;
}

export interface SourceItem {
  refId: string;
  title: string;
  authors?: string[];
  journal?: string;
  year: number | null;
  doi?: string | null;
  url: string;
  citationCount?: number;
}

export interface ResponseMetadata {
  retrievedCount: number;
  rankedCount: number;
  retrievalSources: string[];
  modelUsed: string | null;
  latencyMs: number;
  cacheHit: boolean;
  warnings?: string[];
  searchQuery?: string;      // clean rewritten medical query used for retrieval
}

export interface LLMResponse {
  sessionId: string;
  turnIndex: number;
  conditionOverview: ConditionOverview;
  researchInsights: ResearchInsight[];
  clinicalTrials: ClinicalTrialItem[];
  sources: SourceItem[];
  disclaimer: string;
  metadata: ResponseMetadata;
}

export interface PersonaDirectives {
  preferredDiseases: string[];
  preferredQueryTypes: QueryType[];
  responseDepth: "brief" | "standard" | "deep";
}
