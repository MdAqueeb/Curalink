# CLAUDE.md — AI-Powered Medical Research Assistant

> Authoritative reference for contributors and AI assistants. Read before writing code. All implementation decisions must trace to a section here.

---

## 1. What This System Is

An **R3 pipeline** (Research + Retrieval + Reasoning), not a chatbot or search wrapper:

1. Understand clinical/research intent from structured or free-text input
2. Expand intent into multi-term retrieval queries
3. Fetch bibliographic + trial data from 3 authoritative sources in parallel
4. Rank and filter using hybrid scoring
5. Reason over the filtered corpus with a local LLM
6. Return structured, source-backed, personalized JSON

### Non-Negotiable Constraints

| # | Requirement | Enforced In |
|---|---|---|
| 1 | No hallucination — LLM claims must exist in retrieved sources | `llmService.ts` citation validator |
| 2 | Every `researchInsights` item needs ≥1 verified `sourceRef` | Zod schema + citation checker |
| 3 | Min `MIN_CORPUS_SIZE` docs retrieved before ranking cuts begin (default: 20) | `pipeline.ts` retrieval gate |
| 4 | Follow-up queries inherit `activeDisease` from session | `contextManager.ts:enrichWithContext` |
| 5 | No OpenAI/Gemini — Ollama only | `llmService.ts` — no OpenAI SDK |
| 6 | Frontend receives deterministic JSON only, never freeform text | Zod validates before `res.json()` |
| 7 | Medical disclaimer on every response | Schema enforcement + system prompt |
| 8 | All 3 sources queried: OpenAlex, PubMed, ClinicalTrials | `Promise.allSettled` in pipeline |
| 9 | One failing source must not abort the entire response | `Promise.allSettled` (not `.all`) |
| 10 | Session context in MongoDB, not in-process memory | `Conversation` model, no Map/global |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js ≥22 + Express 5 (TypeScript, ESM) |
| Database | MongoDB 7 via Mongoose |
| LLM | Ollama local (`llama3.1:8b-instruct-q4_K_M` default; override via `OLLAMA_MODEL`) |
| Embeddings | `nomic-embed-text` via Ollama (`OLLAMA_EMBED_MODEL`) |
| Retrieval | OpenAlex API, PubMed E-utilities, ClinicalTrials.gov v2 |

---

## 3. Quick Start

```bash
# Backend (from repo root)
cd backend
cp .env.example .env          # set MONGO_URI and JWT_SECRET at minimum
npm install
npm run dev                   # tsx watch — hot reload

# Smoke-test the full pipeline without HTTP
npm run pipe                  # tsx src/scripts/pingPipeline.ts
npm run pipe "CRISPR therapy for sickle cell disease"

# Type-check only (no emit)
npm run typecheck

# Docker (Mongo + Ollama + backend)
docker compose up -d
```

Swagger UI: `http://localhost:5000/api-docs`
OpenAPI JSON: `http://localhost:5000/api-docs.json`
Health check: `GET http://localhost:5000/api/v1/health`

---

## 4. Environment Variables

All variables are validated at startup by `backend/src/config/env.ts` (Zod). Missing required vars crash the process with a clear error.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `MONGO_URI` | yes | — | MongoDB connection string |
| `JWT_SECRET` | yes | — | Min 32 chars |
| `OLLAMA_URL` | no | `http://localhost:11434` | |
| `OLLAMA_MODEL` | no | `llama3.1:8b-instruct-q4_K_M` | Primary LLM |
| `OLLAMA_EMBED_MODEL` | no | `nomic-embed-text` | |
| `LLM_TEMPERATURE` | no | `0.1` | |
| `LLM_NUM_CTX` | no | `8192` | Context window (tokens) |
| `LLM_TIMEOUT_MS` | no | `120000` | |
| `NCBI_API_KEY` | no | — | Higher PubMed rate limits |
| `OPENALEX_MAILTO` | no | — | Polite-pool access |
| `CACHE_TTL_HOURS_PUBS` | no | `6` | Publication cache TTL |
| `CACHE_TTL_HOURS_TRIALS` | no | `24` | Trial cache TTL |
| `RANKING_TOPK` | no | `20` | Top-K for standard mode |
| `RANKING_TOPK_TRIALS` | no | `5` | Trial results sent to LLM |
| `MIN_CORPUS_SIZE` | no | `20` | Minimum docs before ranking |
| `RATE_LIMIT_PER_MIN` | no | `30` | Per-IP rate limit |
| `OPENALEX_MAX_RESULTS` | no | `200` | |
| `PUBMED_MAX_RESULTS` | no | `200` | |
| `CT_MAX_RESULTS` | no | `100` | |

---

## 5. API Routes

Base prefix: `/api/v1`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/research` | optional | New research query (structured or free-text) |
| `POST` | `/followup` | optional | Follow-up query — requires `sessionId` |
| `GET` | `/session/:id` | optional | Retrieve session history |
| `DELETE` | `/session/:id` | optional | Delete session |
| `GET` | `/health` | none | Health + dependency status |

**Request body fields** (`POST /research` and `/followup`):

```
{
  message?:   string          // free-text query (use this OR disease/query)
  disease?:   string          // structured disease name
  query?:     string          // structured free-text question
  sessionId?: string          // required for /followup
  queryType?: "treatment" | "mechanism" | "trial" | "prevention" | "general"
  mode?:      "brief" | "standard" | "deep" | "high_quality"
  userAge?:   number
}
```

`mode` affects `topK`: `brief`→15, `standard`→`RANKING_TOPK` (20), `deep`→30.

---

## 6. Pipeline Flow

```
POST /api/v1/research
  → queryProcessor        (unify structured + free-text → canonical IntentObject)
  → contextManager        (load session, inherit activeDisease if missing)
  → retrievalOrchestrator (cache check → Promise.allSettled: OpenAlex + PubMed + ClinicalTrials)
  → rankingEngine         (dedup → BM25 + cosine embed top-60 → recency + credibility → top-K)
  → llmService            (build grounded prompt → Ollama → validate citations → Zod)
  → contextManager        (persist turn + update activeDisease/activeConcepts)
  → personalizationEngine (recordQuery for future personalization)
  → res.json(structured)
```

Cache key: `SHA256(normalized query string)` → MongoDB TTL collection. LLM is always re-run on cache hit (corpus is cached; reasoning is not).

---

## 7. Key Services (`backend/src/services/`)

| File | Responsibility |
|---|---|
| `pipeline.ts` | Orchestrates the full request end-to-end |
| `queryProcessor.ts` | Unifies inputs → `IntentObject`; MeSH normalization; synonym expansion; query assembly |
| `meshNormalizer.ts` | Acronym → preferred MeSH term lookups via `data/mesh_terms.json` |
| `contextManager.ts` | MongoDB session load/save; `activeDisease`/`activeConcepts` inheritance |
| `retrievalOrchestrator.ts` | Parallel retrieval with `Promise.allSettled`; cache read/write |
| `cacheService.ts` | SHA256-keyed read/write against `research_cache` collection |
| `rankingEngine.ts` | Custom BM25 (k1=1.5, b=0.75, title weight=3×) + embedding cosine on top-60 BM25 candidates + recency decay + credibility → composite hybrid score |
| `embedder.ts` | Ollama `/api/embeddings` calls; SHA256-keyed MongoDB embedding cache |
| `llmService.ts` | Prompt construction (4 mandatory sections); Ollama `/api/generate`; citation validation |
| `personalizationEngine.ts` | User profile signals → adjust `topK`, `temporalBias`, `queryType` defaults |

### Retrieval Sources (`backend/src/services/retrievers/`)

| Retriever | Fetch ceiling | Notes |
|---|---|---|
| `openAlexRetriever` | 200 | Paginate 100/page; `publication_year:>2015,type:article` |
| `pubmedRetriever` | 200 | 2-step: esearch (IDs) → efetch (XML); batch 100 |
| `clinicalTrialsRetriever` | 100 | Status: RECRUITING, COMPLETED, ACTIVE_NOT_RECRUITING |

---

## 8. Ranking Details

**Weights** (`backend/src/config/rankingWeights.ts`):
```
bm25: 0.25  |  semantic: 0.40  |  recency: 0.20  |  credibility: 0.15
```

**BM25**: Custom implementation in `rankingEngine.ts` (no external library). Title tokens weighted 3× abstract tokens.

**Semantic**: Embeddings computed only on top-60 BM25 candidates to bound latency. If Ollama embeddings are unavailable, falls back to BM25-only ranking.

**Recency**: Exponential decay `exp(-0.17 × age)` (≈4-year half-life). `temporalBias=seminal` inverts the decay to surface foundational papers.

**Credibility**: `0.5 × sourceWeight + 0.5 × journalTierScore`.
- Source weights: pubmed=1.0, clinicaltrials=0.9, openalex=0.85
- Journal tiers: Q1=1.0, Q2=0.75, Q3=0.5, unknown=0.35

---

## 9. LLM Prompt Structure (4 mandatory sections)

1. **System Role** — anti-hallucination rules; JSON-only output instruction
2. **Retrieved Context** — top-K papers as `[Source N]` blocks + top-5 trials
3. **Conversation History** — last 4 turns from session
4. **Current Query** — active disease context + user question

Temperature: `0.1`. Context window: `8192` tokens. Max output: `2048` tokens.
Defined in `backend/src/services/prompts/medicalResearch.ts`.

---

## 10. API Contract — Response Schema

> **Do not break this schema.** Validated by Zod (`backend/src/schemas/research.schema.ts`) before every `res.json()`. The `schema-guardian` agent owns this contract.

```typescript
{
  sessionId:        string,
  turnIndex:        number,
  conditionOverview: {
    disease:        string,
    subtypes?:      string[],
    summary:        string,
    evidenceLevel:  "high" | "moderate" | "low"
  },
  researchInsights: [{
    insightId:       string,
    claim:           string,
    detail?:         string,
    sourceRefs:      string[],      // ≥1 required; verified against sources[]
    confidence:      "high" | "moderate" | "low",
    year?:           number | null,
    citationWarning?: string
  }],
  clinicalTrials: [{
    nctId:         string,
    title:         string,
    status:        string,
    phase:         string,
    summary?:      string,
    url:           string,
    relevanceNote?: string
  }],
  sources: [{
    refId:         string,
    title:         string,
    authors?:      string[],
    journal?:      string,
    year:          number | null,
    doi?:          string | null,
    url:           string,
    citationCount?: number
  }],
  disclaimer: string,
  metadata: {
    retrievedCount:    number,
    rankedCount:       number,
    retrievalSources:  string[],
    modelUsed:         string | null,
    latencyMs:         number,
    cacheHit:          boolean,
    warnings?:         string[]      // e.g. "retrieval_error:pubmed", "reranker_disabled"
  }
}
```

---

## 11. MongoDB Collections

| Collection | TTL | Purpose |
|---|---|---|
| `conversations` | none | Sessions, turns, `activeDisease`, `activeConcepts` |
| `research_cache` | 6h (pubs) / 24h (trials) | Query result cache keyed by `SHA256(query)` |
| `user_profiles` | none | Disease affinity, query type preference, response depth |
| `embedding_cache` | 30 days | Document vectors keyed by `sha256(title+abstract)` |

Model files: `backend/src/models/`

---

## 12. Seed Data (`backend/data/`)

| File | Purpose |
|---|---|
| `mesh_terms.json` | Acronym → preferred MeSH term mappings |
| `synonyms.json` | Disease/concept synonym lists for query expansion |
| `journal_tiers.json` | Scimago Q1/Q2/Q3 tiers → credibility scoring |

To add a disease or acronym: update `synonyms.json` and `mesh_terms.json`. Use the `seed-data` agent skill for bulk additions.

---

## 13. Latency Budget

| Stage | Target |
|---|---|
| Input + query expansion | 50ms |
| Context load | 30ms |
| Cache lookup | 20ms |
| Parallel retrieval (cache miss) | 800–1500ms |
| Dedup + BM25 build | 100ms |
| Embeddings (top-60 candidates, with cache) | 200–600ms |
| LLM inference | 2000–5000ms |
| Validation + serialize | 50ms |
| **Total (cache miss)** | **~4–7s** |

---

## 14. Agent Responsibilities

When modifying specific areas, use the appropriate specialist agent:

| Agent | Owns |
|---|---|
| `prompt-engineer` | `prompts/medicalResearch.ts`, citation validation in `llmService.ts` |
| `schema-guardian` | `schemas/research.schema.ts`, `docs/openapi.ts`, API contract (§10) |
| `retrieval-debugger` | Empty/low-relevance corpus — query strings, synonym expansion, live API responses |
| `medical-researcher` | Any change touching query expansion, retrieval, ranking, or LLM reasoning |
| `seed-data` | Bulk additions to `data/` JSON files |
| `run-pipeline` | End-to-end smoke testing without HTTP |

---

## 15. Anti-Hallucination Rules (for LLM prompt authors)

1. Every claim in `researchInsights` must cite a `refId` from `sources[]`.
2. The prompt must include explicit instruction: "only assert facts present in the retrieved context blocks."
3. If a claim cannot be sourced, the LLM must set `citationWarning` rather than omit `sourceRefs`.
4. Citation validator in `llmService.ts` strips or flags any `sourceRef` not present in the ranked corpus before Zod validation runs.
