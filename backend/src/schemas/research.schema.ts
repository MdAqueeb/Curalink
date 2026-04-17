import { z } from "zod";

const baseRequestObject = z.object({
  disease: z.string().trim().min(1).optional(),
  query: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(1).optional(),
  userAge: z.number().int().min(0).max(120).optional(),
  queryType: z.enum(["treatment", "mechanism", "trial", "prevention", "general"]).optional(),
  mode: z.enum(["brief", "standard", "deep", "high_quality"]).optional(),
});

export const researchRequestSchema = baseRequestObject.refine(
  (v) => Boolean(v.message) || Boolean(v.disease) || Boolean(v.query),
  { message: "Provide either `message` (free text) or at least one of `disease`/`query`." }
);
export type ResearchRequest = z.infer<typeof researchRequestSchema>;

export const followupRequestSchema = baseRequestObject
  .extend({ sessionId: z.string().trim().min(1, "sessionId required for follow-up") })
  .refine(
    (v) => Boolean(v.message) || Boolean(v.disease) || Boolean(v.query),
    { message: "Provide either `message` (free text) or at least one of `disease`/`query`." }
  );
export type FollowupRequest = z.infer<typeof followupRequestSchema>;

const conditionOverviewSchema = z.object({
  disease: z.string(),
  subtypes: z.array(z.string()).optional(),
  summary: z.string(),
  evidenceLevel: z.enum(["high", "moderate", "low"]),
});

const insightSchema = z.object({
  insightId: z.string(),
  claim: z.string(),
  detail: z.string().optional(),
  sourceRefs: z.array(z.string()), // ≥1 per spec; citationWarning signals uncited insights (graceful degradation)
  confidence: z.enum(["high", "moderate", "low"]),
  year: z.number().int().nullable().optional(),
  citationWarning: z.string().optional(),
});

const trialItemSchema = z.object({
  nctId: z.string(),
  title: z.string(),
  status: z.string(),
  phase: z.string(),
  summary: z.string().optional(),
  url: z.string(),
  relevanceNote: z.string().optional(),
});

const sourceItemSchema = z.object({
  refId: z.string(),
  title: z.string(),
  authors: z.array(z.string()).optional(),
  journal: z.string().optional(),
  year: z.number().int().nullable(),
  doi: z.string().nullable().optional(),
  url: z.string(),
  citationCount: z.number().int().optional(),
});

export const researchResponseSchema = z.object({
  sessionId: z.string(),
  turnIndex: z.number().int(),
  conditionOverview: conditionOverviewSchema,
  researchInsights: z.array(insightSchema),
  clinicalTrials: z.array(trialItemSchema),
  sources: z.array(sourceItemSchema),
  disclaimer: z.string(),
  metadata: z.object({
    retrievedCount: z.number().int(),
    rankedCount: z.number().int(),
    retrievalSources: z.array(z.string()),
    modelUsed: z.string().nullable(),
    latencyMs: z.number().int(),
    cacheHit: z.boolean(),
    warnings: z.array(z.string()).optional(),
  }),
});

export type ResearchResponse = z.infer<typeof researchResponseSchema>;
