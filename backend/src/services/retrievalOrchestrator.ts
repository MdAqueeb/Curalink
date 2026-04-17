import { env } from "../config/env.js";
import type { IntentObject, Publication, RetrievalBundle, Trial } from "../types/domain.js";
import { logger } from "../utils/logger.js";
import { computeQueryHash } from "../utils/hash.js";
import { fetchOpenAlex } from "./retrievers/openAlexRetriever.js";
import { fetchPubMed } from "./retrievers/pubmedRetriever.js";
import { fetchClinicalTrials } from "./retrievers/clinicalTrialsRetriever.js";
import { getCached, setCached } from "./cacheService.js";

interface CachedPubs {
  publications: Publication[];
}

interface CachedTrials {
  trials: Trial[];
}

export async function runRetrieval(intent: IntentObject): Promise<RetrievalBundle> {
  const queryKey = intent.queries[1] ?? intent.rawInput;
  const pubsCacheKey = computeQueryHash(queryKey, "pubs");
  const trialsCacheKey = computeQueryHash(queryKey, "trials");

  const [cachedPubs, cachedTrials] = await Promise.all([
    getCached<CachedPubs>(pubsCacheKey, "pubs"),
    getCached<CachedTrials>(trialsCacheKey, "trials"),
  ]);

  if (cachedPubs && cachedTrials) {
    logger.info("retrieval cache hit (full)", { key: pubsCacheKey.slice(0, 12) });
    return {
      publications: cachedPubs.publications,
      trials: cachedTrials.trials,
      retrievalErrors: [],
      cacheHit: true,
    };
  }

  const [openAlex, pubmed, trials] = await Promise.allSettled([
    fetchOpenAlex(intent.queries[1], env.OPENALEX_MAX_RESULTS),
    fetchPubMed(intent.queries[0], env.PUBMED_MAX_RESULTS),
    fetchClinicalTrials(intent.primaryDisease, intent.clinicalConcept, env.CT_MAX_RESULTS),
  ]);

  const errors: { source: string; message: string }[] = [];
  const collect = <T>(name: string, settled: PromiseSettledResult<T[]>): T[] => {
    if (settled.status === "fulfilled") return settled.value;
    errors.push({ source: name, message: (settled.reason as Error)?.message ?? "unknown" });
    logger.warn(`${name} retriever failed`, { err: errors.at(-1)?.message });
    return [];
  };

  const publications: Publication[] = cachedPubs
    ? cachedPubs.publications
    : [...collect("openalex", openAlex), ...collect("pubmed", pubmed)];

  const trialList: Trial[] = cachedTrials
    ? cachedTrials.trials
    : collect("clinicaltrials", trials);

  if (publications.length + trialList.length < env.MIN_CORPUS_SIZE) {
    logger.warn("partial corpus below minimum", {
      pubs: publications.length,
      trials: trialList.length,
      threshold: env.MIN_CORPUS_SIZE,
    });
    errors.push({ source: "pipeline", message: "min_corpus_size_not_met" });
  }

  // Cache publications and trials separately with their own TTLs.
  await Promise.all([
    cachedPubs
      ? Promise.resolve()
      : setCached(pubsCacheKey, "pubs", { publications }, env.CACHE_TTL_HOURS_PUBS),
    cachedTrials
      ? Promise.resolve()
      : setCached(trialsCacheKey, "trials", { trials: trialList }, env.CACHE_TTL_HOURS_TRIALS),
  ]);

  return {
    publications,
    trials: trialList,
    retrievalErrors: errors,
    cacheHit: Boolean(cachedPubs && cachedTrials),
  };
}
