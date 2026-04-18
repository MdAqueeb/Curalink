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
        keep_alive: "10m",
        options: {
          temperature: env.LLM_TEMPERATURE,
          top_p: 0.9,
          num_ctx: env.LLM_NUM_CTX,
          num_predict: 200,
          num_thread: 0,   // use all available CPU cores
          num_batch: 512,  // larger batch = faster prompt processing
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

// Body-part relevance keywords for the hard post-processing filter
const BODY_EXPANSIONS: Record<string, string[]> = {
  hand:     ["hand", "wrist", "finger", "thumb", "palm", "carpal", "upper limb", "forearm"],
  wrist:    ["wrist", "hand", "carpal", "forearm", "upper limb"],
  arm:      ["arm", "elbow", "forearm", "upper limb", "humerus"],
  shoulder: ["shoulder", "rotator", "cuff", "upper limb", "arm"],
  head:     ["head", "skull", "cranial", "brain", "scalp", "cerebr"],
  neck:     ["neck", "cervical", "cervico"],
  chest:    ["chest", "thorax", "thoracic", "rib", "sternum"],
  back:     ["back", "spine", "spinal", "lumbar", "vertebr", "disc"],
  knee:     ["knee", "patella", "patellar", "lower limb", "leg"],
  leg:      ["leg", "lower limb", "thigh", "calf", "tibia", "fibula"],
  ankle:    ["ankle", "foot", "plantar", "lower limb"],
  foot:     ["foot", "feet", "plantar", "ankle", "lower limb"],
  hip:      ["hip", "pelvis", "pelvic", "groin"],
  abdomen:  ["abdomen", "abdominal", "stomach", "gastric", "bowel"],
  eye:      ["eye", "ocular", "vision", "cornea"],
  ear:      ["ear", "hearing", "auditory"],
};

const TRAUMA_TERMS = ["injur", "trauma", "fall", "fractur", "sprain", "wound", "break", "lacerat", "contus", "damage"];

const SPORTS_TERMS = [
  "muscle", "sport", "exercise", "athletic", "physical activity", "strain",
  "sprain", "tendon", "ligament", "soft tissue", "overuse", "exertion",
  "pain relief", "recovery", "rehabilitation", "physiotherapy",
];

function isInsightRelevant(
  claim: string,
  sourceRefs: string[],
  topPubs: RankedDoc[],
  bodyPart?: string,
  triggerEvent?: string,
  activity?: string,
): boolean {
  const lower = claim.toLowerCase();

  // Activity context filter: must relate to sports/exercise/muscle pain
  if (activity) {
    const claimOk = SPORTS_TERMS.some((t) => lower.includes(t)) ||
                    TRAUMA_TERMS.some((t) => lower.includes(t));
    if (claimOk) return true;
    // Check source title too
    const pub = topPubs.find((p) => sourceRefs.includes(p.doc.id));
    if (pub) {
      const t = pub.doc.title.toLowerCase();
      return SPORTS_TERMS.some((s) => t.includes(s)) || TRAUMA_TERMS.some((s) => t.includes(s));
    }
    return false;
  }

  if (!bodyPart) return true; // no body-part lock → no filter

  const keywords = BODY_EXPANSIONS[bodyPart] ?? [bodyPart];
  const claimHasBody   = keywords.some((k) => lower.includes(k));
  const claimHasTrauma = triggerEvent ? TRAUMA_TERMS.some((t) => lower.includes(t)) : false;
  if (claimHasBody || claimHasTrauma) return true;

  const pub = topPubs.find((p) => sourceRefs.includes(p.doc.id));
  if (pub) {
    const titleLower = pub.doc.title.toLowerCase();
    return (
      keywords.some((k) => titleLower.includes(k)) ||
      (!!triggerEvent && TRAUMA_TERMS.some((t) => titleLower.includes(t)))
    );
  }
  return false;
}

function validateAndShape(raw: RawLLMOutput, ctx: ValidationContext): {
  conditionOverview: ConditionOverview;
  researchInsights: ResearchInsight[];
  clinicalTrials: ClinicalTrialItem[];
  sources: SourceItem[];
  warnings: string[];
} {
  const warnings: string[] = [];

  // Lock the topic to the patient's body part / symptom — never let the LLM override it
  const lockedDisease = ctx.intent.triggerEvent
    ? `${ctx.intent.primaryDisease || "pain"} after ${ctx.intent.triggerEvent}`
    : (raw.conditionOverview?.disease ?? ctx.intent.primaryDisease ?? "Unknown");

  const overview: ConditionOverview = {
    disease: lockedDisease,
    subtypes: raw.conditionOverview?.subtypes ?? [],
    summary:
      raw.conditionOverview?.summary ??
      "The available research does not provide sufficient evidence on this specific point.",
    evidenceLevel:
      (raw.conditionOverview?.evidenceLevel as ConditionOverview["evidenceLevel"]) ?? "low",
  };

  const allInsights: ResearchInsight[] = (raw.researchInsights ?? []).map((ins, i) => {
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

  // Hard filter: discard insights that don't relate to the patient's body part / activity / trigger
  const insights = allInsights.filter((ins) =>
    isInsightRelevant(ins.claim, ins.sourceRefs, ctx.topPubs, ctx.intent.bodyPart, ctx.intent.triggerEvent, ctx.intent.activity)
  );
  if (allInsights.length > 0 && insights.length < allInsights.length) {
    warnings.push(`filtered_irrelevant_insights:${allInsights.length - insights.length}`);
  }

  // Build trials directly from the retrieved corpus — the LLM no longer outputs clinicalTrials.
  // This eliminates ~100 output tokens and removes one common source of hallucinated NCT IDs.
  const trials: ClinicalTrialItem[] = ctx.topTrials.map((t) => ({
    nctId: t.nctId,
    title: t.title,
    status: t.status,
    phase: t.phase,
    summary: t.summary || undefined,
    url: t.url,
  }));

  // Always include all top-ranked publications as sources so the list is never empty.
  // Insights reference these by refId; the LLM no longer outputs a sources array.
  const sources: SourceItem[] = ctx.topPubs.map((r) => ({
    refId: r.doc.id,
    title: r.doc.title,
    authors: r.doc.authors,
    journal: r.doc.journal,
    year: r.doc.year,
    doi: r.doc.doi ?? null,
    url: r.doc.url,
    citationCount: r.doc.citationCount,
  }));

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

function extractClaim(abstract: string, title: string): string {
  if (!abstract) return title.slice(0, 200);
  const sentences = abstract
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  // Prefer the conclusion (last sentence) over the background (first sentence)
  const last = sentences[sentences.length - 1];
  return (last && last.length <= 200 ? last : sentences[0] ?? title).slice(0, 200);
}

function buildFallbackRaw(opts: GenerateOptions): RawLLMOutput {
  const disease = opts.intent.primaryDisease || "the queried condition";
  const patientCtx = opts.intent.patientSummary ? `${opts.intent.patientSummary} ` : "";

  const abstractText = opts.topPubs
    .slice(0, 3)
    .map((r) => r.doc.abstract?.slice(0, 150))
    .filter(Boolean)
    .join(" ")
    .slice(0, 400);

  const summary =
    patientCtx +
    (abstractText ||
      (opts.topPubs.length > 0
        ? `${opts.topPubs.length} sources retrieved for ${disease}. Review sources below for details.`
        : `No research sources could be retrieved for "${disease}". Please check the spelling or try a related term.`));

  return {
    conditionOverview: {
      disease,
      subtypes: [],
      summary,
      evidenceLevel: opts.topPubs.length >= 5 ? "moderate" : "low",
    },
    // In fallback mode, prefer papers whose title mentions the body part (keeps filter pass-rate high)
    researchInsights: opts.topPubs
      .filter((r) =>
        isInsightRelevant(
          r.doc.title + " " + (r.doc.abstract ?? ""),
          [r.doc.id],
          opts.topPubs,
          opts.intent.bodyPart,
          opts.intent.triggerEvent,
          opts.intent.activity,
        )
      )
      .slice(0, 10)
      .map((r, i) => ({
        insightId: `ins_${String(i + 1).padStart(3, "0")}`,
        claim: extractClaim(r.doc.abstract, r.doc.title),
        sourceRefs: [r.doc.id],
        confidence: "low" as const,
        year: r.doc.year,
      })),
  };
}

export async function generateResearchResponse(opts: GenerateOptions): Promise<LLMResponse> {
  const { prompt, retrievedIds, trialIds } = buildPrompt(
    opts.intent,
    opts.topPubs,
    opts.topTrials,
    opts.persona,
    env.LLM_NUM_CTX
  );

  let raw: RawLLMOutput;
  let modelUsed: string | null = env.OLLAMA_MODEL;
  const warnings: string[] = [];
  try {
    const text = await callOllama(prompt);
    raw = tryParseJson(text);
  } catch (err) {
    if (err instanceof OllamaUnavailableError) {
      logger.warn("LLM unavailable — using corpus-extracted fallback", { err: err.message });
      modelUsed = "corpus-fallback";
      warnings.push("llm_fallback_mode");
      raw = buildFallbackRaw(opts);
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
      searchQuery: opts.intent.searchQuery,
    },
  };

  return response;
}
