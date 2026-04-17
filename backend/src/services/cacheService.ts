import { ResearchCache } from "../models/ResearchCache.js";
import { logger } from "../utils/logger.js";

export async function getCached<T = unknown>(
  queryHash: string,
  source: string
): Promise<T | null> {
  try {
    const doc = await ResearchCache.findOne({ queryHash, source }).lean();
    if (!doc) return null;
    return doc.results as T;
  } catch (err) {
    logger.warn("cache lookup failed", { err: (err as Error).message });
    return null;
  }
}

export async function setCached(
  queryHash: string,
  source: string,
  results: unknown,
  ttlHours: number
): Promise<void> {
  const expireAt = new Date(Date.now() + ttlHours * 3_600_000);
  try {
    await ResearchCache.updateOne(
      { queryHash, source },
      { $set: { results, expireAt } },
      { upsert: true }
    );
  } catch (err) {
    logger.warn("cache write failed", { err: (err as Error).message });
  }
}
