import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import {
  followupRequestSchema,
  researchRequestSchema,
  researchResponseSchema,
} from "../schemas/research.schema.js";
import { runResearchPipeline } from "../services/pipeline.js";
import { Conversation } from "../models/Conversation.js";
import { deleteSession } from "../services/contextManager.js";

export async function postResearch(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = researchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, "Invalid request", 422, parsed.error.flatten());
      return;
    }
    const { response, generatedSessionId } = await runResearchPipeline({
      input: parsed.data,
      userId: req.user?.id,
    });

    const validated = researchResponseSchema.safeParse(response);
    if (!validated.success) {
      sendError(res, "LLM produced invalid output", 502, validated.error.flatten());
      return;
    }

    if (generatedSessionId) res.setHeader("X-Session-Id", validated.data.sessionId);
    const status = validated.data.metadata.modelUsed ? 200 : 503;
    sendSuccess(res, validated.data, "Research response", status);
  } catch (err) {
    next(err);
  }
}

export async function postFollowup(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = followupRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, "Invalid follow-up request", 422, parsed.error.flatten());
      return;
    }
    const { response } = await runResearchPipeline({
      input: parsed.data,
      userId: req.user?.id,
    });
    const validated = researchResponseSchema.safeParse(response);
    if (!validated.success) {
      sendError(res, "LLM produced invalid output", 502, validated.error.flatten());
      return;
    }
    const status = validated.data.metadata.modelUsed ? 200 : 503;
    sendSuccess(res, validated.data, "Follow-up response", status);
  } catch (err) {
    next(err);
  }
}

export async function getSession(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = String(req.params.id);
    const session = await Conversation.findOne({ sessionId }).lean();
    if (!session) {
      sendError(res, "Session not found", 404);
      return;
    }
    sendSuccess(
      res,
      {
        sessionId: session.sessionId,
        activeDisease: session.activeDisease,
        activeConcepts: session.activeConcepts,
        turns: session.turns.map((t) => ({
          turnIndex: t.turnIndex,
          userMessage: t.userMessage,
          assistantSummary: t.llmResponse?.conditionOverview?.summary,
          timestamp: t.timestamp,
        })),
      },
      "Session retrieved"
    );
  } catch (err) {
    next(err);
  }
}

export async function removeSession(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const deleted = await deleteSession(String(req.params.id));
    sendSuccess(res, { deleted }, deleted ? "Session deleted" : "Session not found");
  } catch (err) {
    next(err);
  }
}
