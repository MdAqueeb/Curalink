import { Conversation, type ConversationDoc } from "../models/Conversation.js";
import type {
  ConversationHistoryItem,
  IntentObject,
  LLMResponse,
} from "../types/domain.js";
import { logger } from "../utils/logger.js";

export async function loadSession(sessionId: string): Promise<ConversationDoc | null> {
  try {
    return await Conversation.findOne({ sessionId });
  } catch (err) {
    logger.warn("session load failed", { err: (err as Error).message });
    return null;
  }
}

export interface EnrichedContext {
  intent: IntentObject;
  turnIndex: number;
}

export async function enrichWithContext(
  intent: IntentObject,
  sessionId: string | undefined
): Promise<EnrichedContext> {
  if (!sessionId) return { intent, turnIndex: 0 };
  const session = await loadSession(sessionId);
  if (!session) return { intent, turnIndex: 0 };

  if (!intent.primaryDisease && session.activeDisease) {
    intent.primaryDisease = session.activeDisease;
    intent.inheritedFromContext = true;
  }

  const history: ConversationHistoryItem[] = session.turns.slice(-4).map((t) => ({
    userMessage: t.userMessage,
    assistantSummary: t.llmResponse?.conditionOverview?.summary ?? "",
  }));
  intent.conversationHistory = history;

  return { intent, turnIndex: session.turns.length };
}

export async function saveTurn(
  sessionId: string,
  userId: string | undefined,
  intent: IntentObject,
  retrievedSourceIds: string[],
  llmResponse: LLMResponse
): Promise<void> {
  try {
    const existing = await Conversation.findOne({ sessionId });
    const turnIndex = existing ? existing.turns.length : 0;
    const turn = {
      turnIndex,
      userMessage: intent.rawInput,
      intentObject: intent,
      retrievedSourceIds,
      llmResponse,
      timestamp: new Date(),
    };
    // Keep up to 20 unique concepts (clinicalConcept + top expanded terms, excluding generic enrichment words).
    const newConcepts = [intent.clinicalConcept, ...intent.expandedTerms.slice(0, 10)].filter(Boolean);
    const concepts = new Set([...(existing?.activeConcepts ?? []), ...newConcepts]);

    await Conversation.updateOne(
      { sessionId },
      {
        $set: {
          userId,
          activeDisease: intent.primaryDisease || existing?.activeDisease,
          activeConcepts: [...concepts],
        },
        $push: { turns: turn },
        $setOnInsert: { sessionId },
      },
      { upsert: true }
    );
  } catch (err) {
    logger.warn("session save failed", { err: (err as Error).message });
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const r = await Conversation.deleteOne({ sessionId });
  return r.deletedCount > 0;
}
