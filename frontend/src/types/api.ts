export type QueryType = "treatment" | "mechanism" | "trial" | "prevention" | "general";
export type PipelineMode = "brief" | "standard" | "deep" | "high_quality";
export type EvidenceLevel = "high" | "moderate" | "low";
export type ConfidenceLevel = "high" | "moderate" | "low";

export interface ResearchRequest {
  message?: string;
  disease?: string;
  query?: string;
  sessionId?: string;
  userAge?: number;
  queryType?: QueryType;
  mode?: PipelineMode;
}

export interface FollowupRequest extends ResearchRequest {
  sessionId: string;
}

export interface ConditionOverview {
  disease: string;
  subtypes?: string[];
  summary: string;
  evidenceLevel: EvidenceLevel;
}

export interface ResearchInsight {
  insightId: string;
  claim: string;
  detail?: string;
  sourceRefs: string[];
  confidence: ConfidenceLevel;
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
}

export interface ResearchResponse {
  sessionId: string;
  turnIndex: number;
  conditionOverview: ConditionOverview;
  researchInsights: ResearchInsight[];
  clinicalTrials: ClinicalTrialItem[];
  sources: SourceItem[];
  disclaimer: string;
  metadata: ResponseMetadata;
}

export interface SessionTurnSummary {
  turnIndex: number;
  userMessage: string;
  assistantSummary?: string;
  timestamp: string;
}

export interface SessionHistory {
  sessionId: string;
  activeDisease?: string;
  activeConcepts?: string[];
  turns: SessionTurnSummary[];
}

export interface HealthStatus {
  status: "ok" | "degraded";
  mongo: string;
  ollama: "up" | "down";
  model: string;
  embeddingModel: string;
  uptimeSec: number;
  timestamp: string;
}

export interface LocalSession {
  sessionId: string;
  disease: string;
  snippet: string;
  createdAt: string;
}

export interface StoredTurn {
  userMessage: string;
  response: ResearchResponse;
  timestamp: string;
}
