import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import type { LLMResponse, RawInput } from "../types/domain.js";
import { logger } from "../utils/logger.js";
import { processInput } from "./queryProcessor.js";
import { enrichWithContext, saveTurn } from "./contextManager.js";
import { runRetrieval } from "./retrievalOrchestrator.js";
import { rankPublications } from "./rankingEngine.js";
import { generateResearchResponse } from "./llmService.js";
import { buildDirectives, recordQuery } from "./personalizationEngine.js";

export interface PipelineOptions {
  input: RawInput;
  userId?: string;
}

export interface PipelineResult {
  response: LLMResponse;
  generatedSessionId: boolean;
}

export async function runResearchPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const startTime = Date.now();
  const sessionId = opts.input.sessionId || `sess_${randomUUID()}`;
  const generatedSessionId = !opts.input.sessionId;

  // 1. Process input → intent
  const baseIntent = processInput(opts.input);

  // 2. Enrich with session context (returns intent + current turnIndex in one DB read)
  const { intent, turnIndex } = await enrichWithContext(baseIntent, sessionId);

  // 3. Persona (optional)
  const persona = await buildDirectives(opts.userId);

  // 4. Retrieval (parallel + cached)
  const bundle = await logger.timeit("retrieval", () => runRetrieval(intent));

  // 5. Ranking
  const ranking = await logger.timeit("ranking", () =>
    rankPublications(bundle.publications, intent, opts.input.mode)
  );

  // 6. Choose top trials (CT relevance is weak; cap and let LLM filter via NCT IDs)
  const topTrials = bundle.trials.slice(0, env.RANKING_TOPK_TRIALS);

  const retrievalSources: string[] = [];
  if (bundle.publications.some((p) => p.source === "openalex")) retrievalSources.push("openalex");
  if (bundle.publications.some((p) => p.source === "pubmed")) retrievalSources.push("pubmed");
  if (bundle.trials.length > 0) retrievalSources.push("clinicaltrials");

  // 7. LLM
  const response = await logger.timeit("llm", () =>
    generateResearchResponse({
      intent,
      topPubs: ranking.ranked,
      topTrials,
      persona,
      sessionId,
      turnIndex,
      retrievedCountTotal: bundle.publications.length + bundle.trials.length,
      retrievalSources,
      cacheHit: bundle.cacheHit,
      startTime,
    })
  );

  // Surface retrieval errors as warnings
  if (bundle.retrievalErrors.length) {
    response.metadata.warnings = [
      ...(response.metadata.warnings ?? []),
      ...bundle.retrievalErrors.map((e) => `retrieval_error:${e.source}`),
    ];
  }
  if (opts.input.mode === "high_quality") {
    response.metadata.warnings = [
      ...(response.metadata.warnings ?? []),
      "reranker_disabled",
    ];
  }

  // 8. Persist + personalization
  await saveTurn(
    sessionId,
    opts.userId,
    intent,
    ranking.ranked.map((r) => r.doc.id),
    response
  );
  await recordQuery(opts.userId, intent);

  return { response, generatedSessionId };
}
