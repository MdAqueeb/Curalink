import { env } from "../config/env.js";
import { EmbeddingCache } from "../models/EmbeddingCache.js";
import { sha256 } from "../utils/hash.js";
import { logger } from "../utils/logger.js";

interface OllamaEmbedResponse {
  embedding: number[];
}

export async function embedText(text: string): Promise<number[] | null> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;
  const hash = sha256(trimmed);
  const model = env.OLLAMA_EMBED_MODEL;

  try {
    const cached = await EmbeddingCache.findOne({ contentHash: hash, modelName: model }).lean();
    if (cached?.vector?.length) return cached.vector;
  } catch (err) {
    logger.warn("embedding cache lookup failed", { err: (err as Error).message });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.EMBED_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: trimmed.slice(0, 8000) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn("ollama embeddings non-2xx", { status: res.status });
      return null;
    }
    const data = (await res.json()) as OllamaEmbedResponse;
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) return null;

    const expireAt = new Date(Date.now() + env.CACHE_TTL_DAYS_EMBEDDINGS * 86_400_000);
    try {
      await EmbeddingCache.updateOne(
        { contentHash: hash, modelName: model },
        { $set: { vector: data.embedding, expireAt } },
        { upsert: true }
      );
    } catch (err) {
      logger.warn("embedding cache write failed", { err: (err as Error).message });
    }

    return data.embedding;
  } catch (err) {
    logger.warn("ollama embeddings call failed", { err: (err as Error).message });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = [];
  for (const t of texts) {
    out.push(await embedText(t));
  }
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
