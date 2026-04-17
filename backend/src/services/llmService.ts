import { env } from "../config/env.js";
import { DEFAULT_DISCLAIMER } from "../config/constants.js";
import type {
  ConditionOverview,
  IntentObject,
  LLMResponse,
  PersonaDirectives,
  RankedDoc,
  ResearchInsight,
  SourceItem,
  Trial,
  ClinicalTrialItem,
} from "../types/domain.js";
import { logger } from "../utils/logger.js";
import { buildPrompt } from "./prompts/medicalResearch.js";

interface OllamaGenerateResponse {
  response: string;
  done?: boolean;
}

export class OllamaUnavailableError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "OllamaUnavailableError";
  }
}

async function callOllama(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.LLM_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: env.LLM_TEMPERATURE,
          top_p: 0.9,
          num_ctx: env.LLM_NUM_CTX,
          num_predict: 2048,
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new OllamaUnavailableError(`ollama returned ${res.status}`);
    }
    const data = (await res.json()) as OllamaGenerateResponse;
    return data.response ?? "";
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new OllamaUnavailableError("ollama request timed out");
    }
    if (err instanceof OllamaUnavailableError) throw err;
    throw new OllamaUnavailableError((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

interface RawLLMOutput {
  conditionOverview?: Partial<ConditionOverview>;
  researchInsights?: Partial<ResearchInsight>[];
  clinicalTrials?: Partial<ClinicalTrialItem>[];
  sources?: Partial<SourceItem>[];
  disclaimer?: string;
}

function tryParseJson(raw: string): RawLLMOutput {
  const stripped = raw.replace(/```json|```/g, "").trim();
  // Sometimes models prepend prose; grab the outermost {...}
  const match = stripped.match(/\{[\s\S]*\}/);
  const candidate = match ? match[0] : stripped;
  return JSON.parse(candidate) as RawLLMOutput;
}

interface ValidationContext {
  retrievedIds: Set<string>;
  trialIds: Set<string>;
  topPubs: RankedDoc[];
  topTrials: Trial[];
  intent: IntentObject;
}

function validateAndShape(raw: RawLLMOutput, ctx: ValidationContext): {
  conditionOverview: ConditionOverview;
  researchInsights: ResearchInsight[];
  clinicalTrials: ClinicalTrialItem[];
  sources: SourceItem[];
  warnings: string[];
} {
  const warnings: string[] = [];

  const overview: ConditionOverview = {
    disease: raw.conditionOverview?.disease ?? ctx.intent.primaryDisease ?? "Unknown",
    subtypes: raw.conditionOverview?.subtypes ?? [],
    summary:
      raw.conditionOverview?.summary ??
      "The available research does not provide sufficient evidence on this specific point.",
    evidenceLevel:
      (raw.conditionOverview?.evidenceLevel as ConditionOverview["evidenceLevel"]) ?? "low",
  };

  const insights: ResearchInsight[] = (raw.researchInsights ?? []).map((ins, i) => {
    const refs = (ins.sourceRefs ?? []).filter((r) => ctx.retrievedIds.has(r));
    const insight: ResearchInsight = {
      insightId: ins.insightId ?? `ins_${String(i + 1).padStart(3, "0")}`,
      claim: ins.claim ?? "",
      detail: ins.detail,
      sourceRefs: refs,
      confidence: (ins.confidence as ResearchInsight["confidence"]) ?? "low",
      year: ins.year ?? null,
    };
    if (refs.length === 0) {
      insight.citationWarning = "No verified source for this claim.";
      warnings.push(`uncited_insight:${insight.insightId}`);
    }
    return insight;
  });

  const trials: ClinicalTrialItem[] = (raw.clinicalTrials ?? [])
    .filter((t) => t.nctId && ctx.trialIds.has(t.nctId))
    .map((t) => ({
      nctId: t.nctId as string,
      title: t.title ?? "",
      status: t.status ?? "UNKNOWN",
      phase: t.phase ?? "N/A",
      summary: t.summary,
      url: t.url ?? `https://clinicaltrials.gov/study/${t.nctId}`,
      relevanceNote: t.relevanceNote,
    }));

  const sourceMap = new Map<string, SourceItem>();
  for (const r of ctx.topPubs) {
    sourceMap.set(r.doc.id, {
      refId: r.doc.id,
      title: r.doc.title,
      authors: r.doc.authors,
      journal: r.doc.journal,
      year: r.doc.year,
      doi: r.doc.doi ?? null,
      url: r.doc.url,
      citationCount: r.doc.citationCount,
    });
  }
  // Union any extra sources the LLM returned (only if they exist in the retrieved corpus).
  for (const s of raw.sources ?? []) {
    if (s.refId && ctx.retrievedIds.has(s.refId) && !sourceMap.has(s.refId)) {
      sourceMap.set(s.refId, {
        refId: s.refId,
        title: s.title ?? "",
        authors: s.authors as string[] | undefined,
        journal: s.journal,
        year: s.year ?? null,
        doi: s.doi ?? null,
        url: s.url ?? "",
        citationCount: s.citationCount,
      });
    }
  }
  const citedIds = new Set(insights.flatMap((i) => i.sourceRefs));
  const sources = [...sourceMap.values()].filter((s) => citedIds.has(s.refId));

  if (insights.length === 0) warnings.push("no_insights_generated");

  return { conditionOverview: overview, researchInsights: insights, clinicalTrials: trials, sources, warnings };
}

export interface GenerateOptions {
  intent: IntentObject;
  topPubs: RankedDoc[];
  topTrials: Trial[];
  persona?: PersonaDirectives | null;
  sessionId: string;
  turnIndex: number;
  retrievedCountTotal: number;
  retrievalSources: string[];
  cacheHit: boolean;
  startTime: number;
}

export async function generateResearchResponse(opts: GenerateOptions): Promise<LLMResponse> {
  const { prompt, retrievedIds, trialIds } = buildPrompt(
    opts.intent,
    opts.topPubs,
    opts.topTrials,
    opts.persona
  );

  let raw: RawLLMOutput;
  let modelUsed: string | null = env.OLLAMA_MODEL;
  const warnings: string[] = [];
  try {
    const text = await callOllama(prompt);
    raw = tryParseJson(text);
  } catch (err) {
    if (err instanceof OllamaUnavailableError) {
      logger.error("LLM unavailable", { err: err.message });
      modelUsed = null;
      warnings.push("ollama_unreachable");
      raw = {};
    } else if (err instanceof SyntaxError) {
      logger.warn("LLM returned non-JSON output");
      warnings.push("llm_invalid_json");
      raw = {};
    } else {
      throw err;
    }
  }

  const ctx: ValidationContext = {
    retrievedIds,
    trialIds,
    topPubs: opts.topPubs,
    topTrials: opts.topTrials,
    intent: opts.intent,
  };
  const shaped = validateAndShape(raw, ctx);

  const response: LLMResponse = {
    sessionId: opts.sessionId,
    turnIndex: opts.turnIndex,
    conditionOverview: shaped.conditionOverview,
    researchInsights: shaped.researchInsights,
    clinicalTrials: shaped.clinicalTrials,
    sources: shaped.sources,
    disclaimer: DEFAULT_DISCLAIMER,
    metadata: {
      retrievedCount: opts.retrievedCountTotal,
      rankedCount: opts.topPubs.length,
      retrievalSources: opts.retrievalSources,
      modelUsed,
      latencyMs: Date.now() - opts.startTime,
      cacheHit: opts.cacheHit,
      warnings: [...warnings, ...shaped.warnings],
    },
  };

  return response;
}
