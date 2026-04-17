import { UserProfile } from "../models/UserProfile.js";
import type { IntentObject, PersonaDirectives, QueryType } from "../types/domain.js";
import { logger } from "../utils/logger.js";

export async function buildDirectives(
  userId: string | undefined
): Promise<PersonaDirectives | null> {
  if (!userId) return null;
  try {
    const profile = await UserProfile.findOne({ userId }).lean();
    if (!profile) return null;
    return {
      preferredDiseases: profile.preferredDiseases ?? [],
      preferredQueryTypes: profile.preferredQueryTypes ?? [],
      responseDepth: profile.responseDepth ?? "standard",
    };
  } catch (err) {
    logger.warn("persona load failed", { err: (err as Error).message });
    return null;
  }
}

export async function recordQuery(
  userId: string | undefined,
  intent: IntentObject
): Promise<void> {
  if (!userId) return;
  try {
    const profile = await UserProfile.findOne({ userId });
    const item = {
      disease: intent.primaryDisease,
      concept: intent.clinicalConcept,
      queryType: intent.queryType,
      timestamp: new Date(),
    };
    if (!profile) {
      await UserProfile.create({
        userId,
        queryHistory: [item],
        preferredDiseases: intent.primaryDisease ? [intent.primaryDisease] : [],
        preferredQueryTypes: [intent.queryType],
      });
      return;
    }
    profile.queryHistory.push(item);
    // Keep last 100
    profile.queryHistory = profile.queryHistory.slice(-100);
    profile.preferredDiseases = mostFrequent(profile.queryHistory.map((q) => q.disease).filter(Boolean), 5);
    profile.preferredQueryTypes = mostFrequent(
      profile.queryHistory.map((q) => q.queryType).filter(Boolean) as QueryType[],
      3
    ) as QueryType[];
    await profile.save();
  } catch (err) {
    logger.warn("persona record failed", { err: (err as Error).message });
  }
}

function mostFrequent<T extends string>(items: T[], k: number): T[] {
  const counts = new Map<T, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([v]) => v);
}
