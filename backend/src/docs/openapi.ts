import { env } from "../config/env.js";

const requestSchema = {
  type: "object",
  properties: {
    disease: { type: "string", example: "Parkinson's disease" },
    query: { type: "string", example: "Deep Brain Stimulation" },
    message: {
      type: "string",
      example: "What are the latest treatments for Parkinson's using DBS?",
    },
    sessionId: { type: "string", example: "sess_abc123" },
    userAge: { type: "integer", example: 62 },
    queryType: {
      type: "string",
      enum: ["treatment", "mechanism", "trial", "prevention", "general"],
    },
    mode: { type: "string", enum: ["brief", "standard", "deep", "high_quality"] },
  },
  description:
    "Either `message` (free text) or at least one of `disease`/`query` is required.",
};

const followupRequestSchema = {
  type: "object",
  required: ["sessionId"],
  properties: {
    disease: { type: "string", example: "Parkinson's disease" },
    query: { type: "string", example: "Deep Brain Stimulation" },
    message: {
      type: "string",
      example: "What are the latest treatments for Parkinson's using DBS?",
    },
    sessionId: { type: "string", example: "sess_abc123", description: "Required for follow-up turns" },
    userAge: { type: "integer", example: 62 },
    queryType: {
      type: "string",
      enum: ["treatment", "mechanism", "trial", "prevention", "general"],
    },
    mode: { type: "string", enum: ["brief", "standard", "deep", "high_quality"] },
  },
  description:
    "`sessionId` is required. Either `message` or at least one of `disease`/`query` is also required.",
};

const conditionOverview = {
  type: "object",
  required: ["disease", "summary", "evidenceLevel"],
  properties: {
    disease: { type: "string" },
    subtypes: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    evidenceLevel: { type: "string", enum: ["high", "moderate", "low"] },
  },
};

const insight = {
  type: "object",
  required: ["insightId", "claim", "sourceRefs", "confidence"],
  properties: {
    insightId: { type: "string" },
    claim: { type: "string" },
    detail: { type: "string" },
    sourceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
    confidence: { type: "string", enum: ["high", "moderate", "low"] },
    year: { type: "integer", nullable: true },
    citationWarning: { type: "string" },
  },
};

const trial = {
  type: "object",
  required: ["nctId", "title", "status", "phase", "url"],
  properties: {
    nctId: { type: "string" },
    title: { type: "string" },
    status: { type: "string" },
    phase: { type: "string" },
    summary: { type: "string" },
    url: { type: "string" },
    relevanceNote: { type: "string" },
  },
};

const sourceItem = {
  type: "object",
  required: ["refId", "title", "year", "url"],
  properties: {
    refId: { type: "string" },
    title: { type: "string" },
    authors: { type: "array", items: { type: "string" } },
    journal: { type: "string" },
    year: { type: "integer", nullable: true },
    doi: { type: "string", nullable: true },
    url: { type: "string" },
    citationCount: { type: "integer" },
  },
};

const responseSchema = {
  type: "object",
  required: [
    "sessionId",
    "turnIndex",
    "conditionOverview",
    "researchInsights",
    "clinicalTrials",
    "sources",
    "disclaimer",
    "metadata",
  ],
  properties: {
    sessionId: { type: "string" },
    turnIndex: { type: "integer" },
    conditionOverview: { $ref: "#/components/schemas/ConditionOverview" },
    researchInsights: { type: "array", items: { $ref: "#/components/schemas/ResearchInsight" } },
    clinicalTrials: { type: "array", items: { $ref: "#/components/schemas/ClinicalTrial" } },
    sources: { type: "array", items: { $ref: "#/components/schemas/Source" } },
    disclaimer: { type: "string" },
    metadata: { $ref: "#/components/schemas/ResponseMetadata" },
  },
};

const apiSuccess = {
  type: "object",
  required: ["success", "message"],
  properties: {
    success: { type: "boolean" },
    message: { type: "string" },
    data: { $ref: "#/components/schemas/ResearchResponse" },
  },
};

const apiError = {
  type: "object",
  required: ["success", "message"],
  properties: {
    success: { type: "boolean", example: false },
    message: { type: "string" },
    errors: {},
  },
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AI Medical Research Assistant API",
    version: "1.0.0",
    description:
      "R3 (Research + Retrieval + Reasoning) pipeline. Combines OpenAlex + PubMed + ClinicalTrials.gov retrieval with hybrid ranking and a local Ollama LLM to return structured, citation-backed medical research summaries. See CLAUDE.md for the full architecture.",
  },
  servers: [
    { url: `http://localhost:${env.PORT}`, description: "Local dev" },
    { url: "http://backend:5000", description: "Docker network" },
  ],
  tags: [
    { name: "research", description: "Run the R3 pipeline" },
    { name: "session", description: "Multi-turn conversation memory" },
    { name: "health", description: "Operational health probes" },
    { name: "auth", description: "User auth (scaffold)" },
  ],
  paths: {
    "/api/v1/research": {
      post: {
        tags: ["research"],
        summary: "Run a research query",
        description:
          "Executes the full pipeline: query expansion → parallel retrieval → hybrid ranking → LLM reasoning with citation validation. Returns a §9-conforming structured response.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ResearchRequest" } } },
        },
        responses: {
          200: {
            description: "Successful structured research response",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccess" } } },
          },
          422: {
            description: "Invalid request body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
          },
          429: { description: "Rate limit exceeded" },
          502: {
            description: "LLM produced invalid output",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
          },
          503: {
            description:
              "Ollama unreachable — response body still conforms to the response schema; `metadata.warnings` includes `ollama_unreachable`.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccess" } } },
          },
        },
      },
    },
    "/api/v1/followup": {
      post: {
        tags: ["research"],
        summary: "Follow-up turn within an existing session",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/FollowupRequest" } } },
        },
        responses: {
          200: {
            description: "Follow-up response",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccess" } } },
          },
          422: { description: "Invalid request body" },
        },
      },
    },
    "/api/v1/session/{id}": {
      get: {
        tags: ["session"],
        summary: "Retrieve a conversation session",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Session payload" },
          404: { description: "Not found" },
        },
      },
      delete: {
        tags: ["session"],
        summary: "Delete a conversation session",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Delete result" } },
      },
    },
    "/api/v1/health": {
      get: {
        tags: ["health"],
        summary: "Mongo + Ollama health probe",
        responses: {
          200: { description: "Healthy" },
          503: { description: "Degraded" },
        },
      },
    },
  },
  components: {
    schemas: {
      ResearchRequest: requestSchema,
      FollowupRequest: followupRequestSchema,
      ConditionOverview: conditionOverview,
      ResearchInsight: insight,
      ClinicalTrial: trial,
      Source: sourceItem,
      ResponseMetadata: {
        type: "object",
        required: [
          "retrievedCount",
          "rankedCount",
          "retrievalSources",
          "modelUsed",
          "latencyMs",
          "cacheHit",
        ],
        properties: {
          retrievedCount: { type: "integer" },
          rankedCount: { type: "integer" },
          retrievalSources: { type: "array", items: { type: "string" } },
          modelUsed: { type: "string", nullable: true },
          latencyMs: { type: "integer" },
          cacheHit: { type: "boolean" },
          warnings: { type: "array", items: { type: "string" } },
        },
      },
      ResearchResponse: responseSchema,
      ApiSuccess: apiSuccess,
      ApiError: apiError,
    },
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};
