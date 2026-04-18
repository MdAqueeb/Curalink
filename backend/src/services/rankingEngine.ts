import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { env } from "../config/env.js";
import { rankingWeights } from "../config/rankingWeights.js";
import {
  FALLBACK_JOURNAL_TIER_SCORE,
  SOURCE_CREDIBILITY,
} from "../config/constants.js";
import type {
  IntentObject,
  Publication,
  RankedDoc,
  RankingSignals,
} from "../types/domain.js";
import { logger } from "../utils/logger.js";
import { cosineSimilarity, embedText } from "./embedder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const journalTiers: Record<string, "Q1" | "Q2" | "Q3"> = JSON.parse(
  readFileSync(resolve(__dirname, "../../data/journal_tiers.json"), "utf8")
);

function dedup(publications: Publication[]): Publication[] {
  const seen = new Set<string>();
  const out: Publication[] = [];
  for (const pub of publications) {
    const key =
      (pub.doi && pub.doi.toLowerCase()) ||
      pub.pmid ||
      pub.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pub);
  }
  return out;
}

function recencyScore(year: number | null, bias: IntentObject["temporalBias"]): number {
  const currentYear = new Date().getFullYear();
  const age = currentYear - (year ?? currentYear - 5);
  const decay = Math.exp(-0.17 * Math.max(0, age));
  if (bias === "seminal") return 1 - decay;
  return decay;
}

function journalTierScore(journal: string): number {
  const tier = journalTiers[journal.toLowerCase()];
  if (tier === "Q1") return 1;
  if (tier === "Q2") return 0.75;
  if (tier === "Q3") return 0.5;
  return FALLBACK_JOURNAL_TIER_SCORE;
}

function credibilityScore(pub: Publication): number {
  const sourceWeight = SOURCE_CREDIBILITY[pub.source] ?? 0.7;
  const journalWeight = journalTierScore(pub.journal);
  return 0.5 * sourceWeight + 0.5 * journalWeight;
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "and",
  "or",
  "to",
  "for",
  "with",
  "by",
  "is",
  "are",
  "was",
  "were",
  "be",
  "this",
  "that",
  "from",
  "as",
  "at",
  "we",
  "our",
  "their",
  "his",
  "her",
  "it",
  "its",
]);

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

interface BM25Doc {
  id: number;
  tf: Map<string, number>;
  length: number;
  titleTf: Map<string, number>;
  abstractTf: Map<string, number>;
}

function buildBM25(publications: Publication[]) {
  const docs: BM25Doc[] = publications.map((pub, i) => {
    const titleTokens = tokenize(pub.title);
    const abstractTokens = tokenize(pub.abstract);
    const titleTf = new Map<string, number>();
    const abstractTf = new Map<string, number>();
    for (const t of titleTokens) titleTf.set(t, (titleTf.get(t) ?? 0) + 1);
    for (const t of abstractTokens) abstractTf.set(t, (abstractTf.get(t) ?? 0) + 1);
    const tf = new Map<string, number>();
    for (const [t, c] of titleTf) tf.set(t, (tf.get(t) ?? 0) + c * 3); // title weight = 3
    for (const [t, c] of abstractTf) tf.set(t, (tf.get(t) ?? 0) + c);
    return {
      id: i,
      tf,
      length: titleTokens.length * 3 + abstractTokens.length,
      titleTf,
      abstractTf,
    };
  });

  const N = docs.length || 1;
  const avgDl = docs.reduce((s, d) => s + d.length, 0) / N || 1;
  const df = new Map<string, number>();
  for (const d of docs) {
    for (const term of d.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }

  const k1 = 1.5;
  const b = 0.75;
  function score(queryTokens: string[], doc: BM25Doc): number {
    let s = 0;
    for (const q of queryTokens) {
      const dfq = df.get(q);
      if (!dfq) continue;
      const idf = Math.log(1 + (N - dfq + 0.5) / (dfq + 0.5));
      const tf = doc.tf.get(q) ?? 0;
      const norm = tf * (k1 + 1);
      const denom = tf + k1 * (1 - b + b * (doc.length / avgDl));
      s += idf * (denom === 0 ? 0 : norm / denom);
    }
    return s;
  }

  return { docs, score };
}

function minMax(values: number[]): number[] {
  if (values.length === 0) return values;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0);
  return values.map((v) => (v - min) / (max - min));
}

function topKForMode(mode: string | undefined): number {
  if (mode === "brief") return 15;
  if (mode === "deep") return 30;
  return env.RANKING_TOPK;
}

export interface RankingResult {
  ranked: RankedDoc[];
  totalAfterDedup: number;
  embeddingCoverage: number;
}

export async function rankPublications(
  publications: Publication[],
  intent: IntentObject,
  mode?: string
): Promise<RankingResult> {
  const deduped = dedup(publications);
  if (deduped.length === 0) {
    return { ranked: [], totalAfterDedup: 0, embeddingCoverage: 0 };
  }

  const { docs, score } = buildBM25(deduped);
  const queryString = [intent.primaryDisease, intent.clinicalConcept, ...intent.expandedTerms]
    .filter(Boolean)
    .join(" ");
  const queryTokens = tokenize(queryString);
  const bm25Raw = docs.map((d) => score(queryTokens, d));
  const bm25Norm = minMax(bm25Raw);

  // Embeddings (cap to top 60 BM25 hits to control latency).
  const candidateIdx = bm25Raw
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 20)
    .map((x) => x.i);

  const queryVec = await embedText(queryString);
  const semanticRaw = new Array(deduped.length).fill(0) as number[];
  let embedded = 0;
  if (queryVec) {
    for (const i of candidateIdx) {
      const pub = deduped[i];
      const vec = await embedText(`${pub.title}\n\n${pub.abstract}`.slice(0, 4000));
      if (vec) {
        semanticRaw[i] = cosineSimilarity(queryVec, vec);
        embedded++;
      }
    }
  } else {
    logger.warn("query embedding unavailable; falling back to BM25-only ranking");
  }
  const semanticNorm = minMax(semanticRaw);

  const w = rankingWeights;
  const ranked: RankedDoc[] = deduped.map((doc, i) => {
    const recency = recencyScore(doc.year, intent.temporalBias);
    const credibility = credibilityScore(doc);
    const composite =
      w.bm25 * bm25Norm[i] +
      w.semantic * semanticNorm[i] +
      w.recency * recency +
      w.credibility * credibility;
    const signals: RankingSignals = {
      bm25: bm25Raw[i],
      bm25Norm: bm25Norm[i],
      semantic: semanticRaw[i],
      semanticNorm: semanticNorm[i],
      recency,
      credibility,
      composite,
    };
    return { doc, signals };
  });

  ranked.sort((a, b) => b.signals.composite - a.signals.composite);
  const k = topKForMode(mode);

  return {
    ranked: ranked.slice(0, k),
    totalAfterDedup: deduped.length,
    embeddingCoverage: candidateIdx.length === 0 ? 0 : embedded / candidateIdx.length,
  };
}
